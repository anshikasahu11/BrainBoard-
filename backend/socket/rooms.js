// The names of the rooms an event can be sent to.
// A socket only ever joins a workspace room after the server has checked it's a member.
export const workspaceRoom = (workspaceId) => `workspace:${workspaceId}`;

// One private room per user, for things that are only theirs (and for removing
// a kicked member's access in Step 2).
export const userRoom = (userId) => `user:${userId}`;