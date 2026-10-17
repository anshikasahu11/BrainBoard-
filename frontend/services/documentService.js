import { apiFetch } from "@/lib/api";

const base = (workspaceId) => `/api/workspaces/${encodeURIComponent(workspaceId)}/documents`;

export const listDocumentsRequest = (workspaceId, q = "") =>
  apiFetch(q ? `${base(workspaceId)}?q=${encodeURIComponent(q)}` : base(workspaceId));

// The most recently edited documents, newest first. Used by the dashboard.
export const listRecentDocumentsRequest = (workspaceId, limit = 5) =>
  apiFetch(`${base(workspaceId)}?limit=${encodeURIComponent(limit)}`);

export const createDocumentRequest = (workspaceId, data = {}) =>
  apiFetch(base(workspaceId), { method: "POST", body: JSON.stringify(data) });

export const getDocumentRequest = (workspaceId, documentId) =>
  apiFetch(`${base(workspaceId)}/${encodeURIComponent(documentId)}`);

// data: { baseRevision, title?, content? }. The server answers 409 if the
// revision is out of date (someone else saved first).
export const updateDocumentRequest = (workspaceId, documentId, data) =>
  apiFetch(`${base(workspaceId)}/${encodeURIComponent(documentId)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteDocumentRequest = (workspaceId, documentId) =>
  apiFetch(`${base(workspaceId)}/${encodeURIComponent(documentId)}`, { method: "DELETE" });