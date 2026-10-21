// The names of the rooms an event can be sent to.
// A socket only ever joins a workspace room after the server has checked it's a member.

const WORKSPACE_PREFIX = "workspace:";

export const workspaceRoom = (workspaceId) => `${WORKSPACE_PREFIX}${workspaceId}`;
export const isWorkspaceRoom = (name) =>
  typeof name === "string" && name.startsWith(WORKSPACE_PREFIX);
export const workspaceIdFromRoom = (name) => name.slice(WORKSPACE_PREFIX.length);

// One private room per user, for things that are only theirs (like "your access
// to this workspace is gone").
export const userRoom = (userId) => `user:${userId}`;