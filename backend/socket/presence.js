import { workspaceRoom } from "./rooms.js";

// Who is online in a workspace, worked out from the connections actually inside
// its room. There's no separate list to keep up to date, so it can't drift: if a
// connection is in the room it counts, and the moment it leaves it doesn't.
//
// Returns one entry per PERSON (two tabs of the same person are one entry):
//   [{ id, name, editing: [documentId, ...] }]
export async function computePresence(io, workspaceId) {
  const sockets = await io.in(workspaceRoom(workspaceId)).fetchSockets();
  const people = new Map();

  for (const socket of sockets) {
    const { user, editing } = socket.data;
    if (!user) continue;

    if (!people.has(user.id)) {
      people.set(user.id, { id: user.id, name: user.name, editing: new Set() });
    }
    // "Editing" only counts for the workspace this snapshot is about.
    if (editing?.workspaceId === workspaceId && editing.documentId) {
      people.get(user.id).editing.add(editing.documentId);
    }
  }

  return [...people.values()]
    .map((person) => ({ id: person.id, name: person.name, editing: [...person.editing] }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

// Tells everyone in the workspace who's online right now. Returns that list.
// Never throws: presence is a nicety and must not break anything else.
export async function broadcastPresence(io, workspaceId) {
  try {
    const users = await computePresence(io, workspaceId);
    io.to(workspaceRoom(workspaceId)).emit("presence:update", { workspaceId, users });
    return users;
  } catch (error) {
    console.error("Presence update failed:", error.message);
    return [];
  }
}