import { Server } from "socket.io";
import Membership from "../models/Membership.js";
import User from "../models/User.js";
import { env } from "../config/env.js";
import { isObjectId } from "../utils/objectId.js";
import { verifyToken } from "../utils/token.js";
import { setIo } from "./realtime.js";
import { userRoom, workspaceRoom } from "./rooms.js";

const MAX_WORKSPACE_ROOMS = 20; // per connection
const MAX_TIMER_MS = 2_000_000_000; // setTimeout can't count past about 24 days

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
    socket.on("disconnect", () => clearTimeout(expiryTimer));

    // 2. "Let me hear about this workspace." Only members may.
    socket.on("workspace:join", async (workspaceId, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};

      try {
        if (!isObjectId(workspaceId)) return reply({ ok: false, error: "Workspace not found" });

        const room = workspaceRoom(workspaceId);
        if (socket.rooms.has(room)) return reply({ ok: true });

        const open = [...socket.rooms].filter((name) => name.startsWith("workspace:")).length;
        if (open >= MAX_WORKSPACE_ROOMS) {
          return reply({ ok: false, error: "Too many workspaces open at once" });
        }

        // The very same membership check REST uses. A non-member hears exactly what
        // they'd hear from REST, so nobody can probe which workspaces exist.
        const isMember = await Membership.exists({ workspace: workspaceId, user: user.id });
        if (!isMember) return reply({ ok: false, error: "Workspace not found" });

        socket.join(room);
        reply({ ok: true });
      } catch {
        reply({ ok: false, error: "Couldn't join that workspace" });
      }
    });

    socket.on("workspace:leave", (workspaceId, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      if (isObjectId(workspaceId)) socket.leave(workspaceRoom(workspaceId));
      reply({ ok: true });
    });
  });

  setIo(io);
  return io;
}