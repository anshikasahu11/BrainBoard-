import { Server } from "socket.io";
import Document from "../models/Document.js";
import Membership from "../models/Membership.js";
import User from "../models/User.js";
import { env } from "../config/env.js";
import { isObjectId } from "../utils/objectId.js";
import { verifyToken } from "../utils/token.js";
import { broadcastPresence, computePresence } from "./presence.js";
import { setIo } from "./realtime.js";
import { isWorkspaceRoom, userRoom, workspaceIdFromRoom, workspaceRoom } from "./rooms.js";

const MAX_WORKSPACE_ROOMS = 20; // per connection
const MAX_TIMER_MS = 2_000_000_000; // setTimeout can't count past about 24 days
const EVENT_LIMIT = 40; // messages one connection may send...
const EVENT_WINDOW_MS = 10_000; // ...in this long

const NOT_FOUND = { ok: false, error: "Workspace not found" };
const replyTo = (ack) => (typeof ack === "function" ? ack : () => {});

// A small guard against one connection flooding the server with messages.
function withinLimit(socket) {
  const now = Date.now();
  const recent = (socket.data.recent ?? []).filter((time) => now - time < EVENT_WINDOW_MS);
  recent.push(now);
  socket.data.recent = recent;
  return recent.length <= EVENT_LIMIT;
}

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientUrl },
    serveClient: false, // we don't need to serve the browser library from here
    maxHttpBufferSize: 100_000, // messages are tiny: refuse anything over 100 KB
  });

  // 1. Who is connecting? Runs once per connection, before it's accepted.
  //    The browser sends its login token in the handshake.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== "string" || token.length === 0) {
        return next(new Error("Authentication required"));
      }

      let payload;
      try {
        payload = verifyToken(token);
      } catch {
        return next(new Error("Invalid or expired token"));
      }

      const user = await User.findById(payload.sub).select("name");
      if (!user) return next(new Error("This account no longer exists"));

      socket.data.user = { id: user.id, name: user.name };
      socket.data.expiresAt = payload.exp * 1000;
      socket.data.editing = null; // { workspaceId, documentId } while editing a document
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    const { user, expiresAt } = socket.data;

    // A private room, for things that are only for this person.
    socket.join(userRoom(user.id));

    // Close the connection when the token expires. The browser reconnects with a
    // fresh login (or, if it has none, stays out).
    const expiryTimer = setTimeout(
      () => socket.disconnect(true),
      Math.min(Math.max(expiresAt - Date.now(), 0), MAX_TIMER_MS)
    );

    // When a connection closes, the workspaces it was in need to hear who's left.
    // Its rooms are already gone by the "disconnect" event, so remember them first.
    let workspacesLeft = [];
    socket.on("disconnecting", () => {
      workspacesLeft = [...socket.rooms].filter(isWorkspaceRoom).map(workspaceIdFromRoom);
    });
    socket.on("disconnect", () => {
      clearTimeout(expiryTimer);
      for (const workspaceId of workspacesLeft) broadcastPresence(io, workspaceId);
    });

    // 2. "Let me hear about this workspace." Only members may.
    //    The reply includes who is online right now.
    socket.on("workspace:join", async (workspaceId, ack) => {
      const reply = replyTo(ack);

      try {
        if (!withinLimit(socket)) return reply({ ok: false, error: "Slow down" });
        if (!isObjectId(workspaceId)) return reply(NOT_FOUND);

        const room = workspaceRoom(workspaceId);
        if (socket.rooms.has(room)) {
          return reply({ ok: true, presence: await computePresence(io, workspaceId) });
        }

        const open = [...socket.rooms].filter(isWorkspaceRoom).length;
        if (open >= MAX_WORKSPACE_ROOMS) {
          return reply({ ok: false, error: "Too many workspaces open at once" });
        }

        // The very same membership check REST uses. A non-member hears exactly what
        // they'd hear from REST, so nobody can probe which workspaces exist.
        const isMember = await Membership.exists({ workspace: workspaceId, user: user.id });
        if (!isMember) return reply(NOT_FOUND);

        // A fresh start here: no stale "editing" left over from an earlier visit.
        if (socket.data.editing?.workspaceId === workspaceId) socket.data.editing = null;

        await socket.join(room);
        const presence = await broadcastPresence(io, workspaceId);
        reply({ ok: true, presence });
      } catch {
        reply({ ok: false, error: "Couldn't join that workspace" });
      }
    });

    socket.on("workspace:leave", async (workspaceId, ack) => {
      const reply = replyTo(ack);

      try {
        if (isObjectId(workspaceId) && socket.rooms.has(workspaceRoom(workspaceId))) {
          if (socket.data.editing?.workspaceId === workspaceId) socket.data.editing = null;
          await socket.leave(workspaceRoom(workspaceId));
          await broadcastPresence(io, workspaceId);
        }
      } catch {
        // Leaving always counts as done.
      }
      reply({ ok: true });
    });

    // 3. Presence: "I'm editing this document", and "I stopped".
    //    This is information for teammates. It doesn't lock anything.
    socket.on("document:focus", async (payload, ack) => {
      const reply = replyTo(ack);

      try {
        if (!withinLimit(socket)) return reply({ ok: false, error: "Slow down" });

        const { workspaceId, documentId } = payload && typeof payload === "object" ? payload : {};
        if (!isObjectId(workspaceId) || !isObjectId(documentId)) {
          return reply({ ok: false, error: "Invalid request" });
        }

        // Being in the room already proves this person is a member of the workspace.
        if (!socket.rooms.has(workspaceRoom(workspaceId))) {
          return reply({ ok: false, error: "Join the workspace first" });
        }

        const exists = await Document.exists({ _id: documentId, workspace: workspaceId });
        if (!exists) return reply({ ok: false, error: "Document not found" });

        socket.data.editing = { workspaceId, documentId };
        await broadcastPresence(io, workspaceId);
        reply({ ok: true });
      } catch {
        reply({ ok: false, error: "Couldn't update presence" });
      }
    });

    socket.on("document:blur", async (payload, ack) => {
      const reply = replyTo(ack);

      try {
        if (!withinLimit(socket)) return reply({ ok: false, error: "Slow down" });

        const editing = socket.data.editing;
        const workspaceId = payload && typeof payload === "object" ? payload.workspaceId : undefined;

        if (editing && (!workspaceId || editing.workspaceId === workspaceId)) {
          socket.data.editing = null;
          await broadcastPresence(io, editing.workspaceId);
        }
        reply({ ok: true });
      } catch {
        reply({ ok: false, error: "Couldn't update presence" });
      }
    });
  });

  setIo(io);
  return io;
}