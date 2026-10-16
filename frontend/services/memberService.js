import { apiFetch } from "@/lib/api";

const base = (workspaceId) => `/api/workspaces/${encodeURIComponent(workspaceId)}/members`;

export const listMembersRequest = (workspaceId) => apiFetch(base(workspaceId));

export const addMemberRequest = (workspaceId, data) =>
  apiFetch(base(workspaceId), { method: "POST", body: JSON.stringify(data) });

export const updateMemberRoleRequest = (workspaceId, userId, data) =>
  apiFetch(`${base(workspaceId)}/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

// Removing yourself = leaving the workspace.
export const removeMemberRequest = (workspaceId, userId) =>
  apiFetch(`${base(workspaceId)}/${encodeURIComponent(userId)}`, { method: "DELETE" });