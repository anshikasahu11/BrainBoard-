import { apiFetch } from "@/lib/api";

const base = (workspaceId) => `/api/workspaces/${encodeURIComponent(workspaceId)}/ai`;

// Is AI available, and how many requests does this person have left today?
export const getAiStatusRequest = (workspaceId) => apiFetch(`${base(workspaceId)}/status`);

// Runs one AI action: "summarize-document", "explain-snippet", "improve-snippet" or
// "tasks-from-text". Every one of them only SUGGESTS: none changes anything on the server.
// `signal` lets the screen stop waiting if the person closes the panel.
export const runAiRequest = (workspaceId, action, body, signal) =>
  apiFetch(`${base(workspaceId)}/${action}`, { method: "POST", body: JSON.stringify(body), signal });