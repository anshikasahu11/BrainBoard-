import { apiFetch } from "@/lib/api";

export const listWorkspacesRequest = () => apiFetch("/api/workspaces");

export const createWorkspaceRequest = (data) =>
  apiFetch("/api/workspaces", { method: "POST", body: JSON.stringify(data) });

export const getWorkspaceRequest = (workspaceId) =>
  apiFetch(`/api/workspaces/${encodeURIComponent(workspaceId)}`);