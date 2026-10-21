import { broadcastPresence } from "./presence.js";
import { userRoom, workspaceRoom } from "./rooms.js";

// The one place the rest of the backend talks to Socket.IO.
// Controllers call announce(...) AFTER the change is saved.
// Everything is a no-op until the socket server has started (and in any test
// that runs without one), so controllers never have to check.

let io = null;

export function setIo(instance) {
  io = instance;
}

// Browsers send their socket id in an X-Socket-Id header, so the person who made
// a change can be left out of the announcement (they already know). A header
// that doesn't look like a socket id is simply ignored.
const SOCKET_ID = /^[\w-]{10,40}$/;

export function socketIdFrom(req) {
  const id = req.get("x-socket-id");
  return id && SOCKET_ID.test(id) ? id : undefined;
}

// Sends an event to everyone in a workspace's room.
// Never throws: the change is already saved, and a broadcasting hiccup must not
// turn a successful request into an error.
export function emitToWorkspace(workspaceId, event, payload, { exceptSocketId } = {}) {
  if (!io) return;

  try {
    let target = io.to(workspaceRoom(String(workspaceId)));
    // Every socket is also in a room named after its own id, so this leaves one out.
    if (exceptSocketId) target = target.except(exceptSocketId);
    target.emit(event, payload);
  } catch (error) {
    console.error("Real-time announcement failed:", error.message);
  }
}

// The common case in a controller: announce something about THIS request's workspace,
// leaving out the browser that made the change.
export function announce(req, event, payload) {
  emitToWorkspace(
    req.workspace.id,
    event,
    { workspaceId: req.workspace.id, ...payload },
    { exceptSocketId: socketIdFrom(req) }
  );
}

// Sends an event to one person, on every tab they have open.
export function emitToUser(userId, event, payload) {
  if (!io) return;

  try {
    io.to(userRoom(String(userId))).emit(event, payload);
  } catch (error) {
    console.error("Real-time message failed:", error.message);
  }
}

// Takes one person's live access to a workspace away (they were removed or left),
// then tells the others who's still online.
export async function kickFromWorkspace(userId, workspaceId) {
  if (!io) return;

  try {
    await io.in(userRoom(String(userId))).socketsLeave(workspaceRoom(String(workspaceId)));
    await broadcastPresence(io, String(workspaceId));
  } catch (error) {
    console.error("Removing live access failed:", error.message);
  }
}

// Empties a workspace's room (the workspace was deleted).
export function closeWorkspaceRoom(workspaceId) {
  if (!io) return;

  try {
    const room = workspaceRoom(String(workspaceId));
    io.in(room).socketsLeave(room);
  } catch (error) {
    console.error("Closing the workspace room failed:", error.message);
  }
}