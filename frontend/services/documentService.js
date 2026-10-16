import { apiFetch } from "@/lib/api";

const base = (workspaceId) => `/api/workspaces/${encodeURIComponent(workspaceId)}/documents`;

export const listDocumentsRequest = (workspaceId, q = "") =>
  apiFetch(q ? `${base(workspaceId)}?q=${encodeURIComponent(q)}` : base(workspaceId));

export const createDocumentRequest = (workspaceId, data = {}) =>
  apiFetch(base(workspaceId), { method: "POST", body: JSON.stringify(data) });

export const getDocumentRequest = (workspaceId, documentId) =>
  apiFetch(`${base(workspaceId)}/${encodeURIComponent(documentId)}`);

export const deleteDocumentRequest = (workspaceId, documentId) =>
  apiFetch(`${base(workspaceId)}/${encodeURIComponent(documentId)}`, { method: "DELETE" });

// Step 3 adds the update (autosave) request here.