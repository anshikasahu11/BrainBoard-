import { apiFetch } from "@/lib/api";

const base = (workspaceId) => `/api/workspaces/${encodeURIComponent(workspaceId)}/tasks`;

// filters: { q, status, priority, assignee, sort, limit }. Empty ones are left out.
export const listTasksRequest = (workspaceId, filters = {}) => {
  const params = new URLSearchParams();
  for (const name of ["q", "status", "priority", "assignee", "sort", "limit"]) {
    if (filters[name]) params.set(name, String(filters[name]));
  }

  const query = params.toString();
  return apiFetch(query ? `${base(workspaceId)}?${query}` : base(workspaceId));
};

// Counts for the whole workspace. `today` is the visitor's own date (YYYY-MM-DD),
// which decides what counts as overdue.
export const getTaskStatsRequest = (workspaceId, today) =>
  apiFetch(`${base(workspaceId)}/stats?today=${encodeURIComponent(today)}`);

export const createTaskRequest = (workspaceId, data) =>
  apiFetch(base(workspaceId), { method: "POST", body: JSON.stringify(data) });

// Send ONLY the fields that changed, so you never undo a teammate's edit to another field.
export const updateTaskRequest = (workspaceId, taskId, data) =>
  apiFetch(`${base(workspaceId)}/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

// Drag and drop: data = { status, afterId }.
export const moveTaskRequest = (workspaceId, taskId, data) =>
  apiFetch(`${base(workspaceId)}/${encodeURIComponent(taskId)}/move`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteTaskRequest = (workspaceId, taskId) =>
  apiFetch(`${base(workspaceId)}/${encodeURIComponent(taskId)}`, { method: "DELETE" });