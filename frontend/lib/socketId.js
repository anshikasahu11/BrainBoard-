// The id of this tab's live connection, so the server can leave it out of
// announcements about changes it made itself. (Plain module state: apiFetch isn't
// a React component, so it can't use context.)
let current = null;

export const setSocketId = (id) => {
  current = id;
};

export const getSocketId = () => current;