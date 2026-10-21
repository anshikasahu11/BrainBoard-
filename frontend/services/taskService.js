import { apiFetch } from "@/lib/api";

const base = (workspaceId) => `/api/workspaces/${encodeURIComponent(workspaceId)}/tasks`;

// filters: { q, priority, assignee }. Empty ones are left out.
export const listTasksRequest = (workspaceId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.assignee) params.set("assignee", filters.assignee);

  const query = params.toString();
  return apiFetch(query ? `${base(workspaceId)}?${query}` : base(workspaceId));
};

export const createTaskRequest = (workspaceId, data) =>
  apiFetch(base(workspaceId), { method: "POST", body: JSON.stringify(data) });

// Send ONLY the fields that changed, so you never undo a teammate's edit to another field.
export const updateTaskRequest = (workspaceId, taskId, data) =>
  apiFetch(`${base(workspaceId)}/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

// Drag and drop (used in Step 3): data = { status, afterId }.
export const moveTaskRequest = (workspaceId, taskId, data) =>
  apiFetch(`${base(workspaceId)}/${encodeURIComponent(taskId)}/move`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteTaskRequest = (workspaceId, taskId) =>
  apiFetch(`${base(workspaceId)}/${encodeURIComponent(taskId)}`, { method: "DELETE" });