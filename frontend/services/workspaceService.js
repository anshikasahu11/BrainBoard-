import { apiFetch } from "@/lib/api";

export const listWorkspacesRequest = () => apiFetch("/api/workspaces");

export const createWorkspaceRequest = (data) =>
  apiFetch("/api/workspaces", { method: "POST", body: JSON.stringify(data) });

export const getWorkspaceRequest = (workspaceId) =>
  apiFetch(`/api/workspaces/${encodeURIComponent(workspaceId)}`);

// Used by the Settings page in Step 5.
export const renameWorkspaceRequest = (workspaceId, data) =>
  apiFetch(`/api/workspaces/${encodeURIComponent(workspaceId)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteWorkspaceRequest = (workspaceId) =>
  apiFetch(`/api/workspaces/${encodeURIComponent(workspaceId)}`, { method: "DELETE" });