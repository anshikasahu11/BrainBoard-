import { apiFetch } from "@/lib/api";

const base = (workspaceId, documentId) =>
  `/api/workspaces/${encodeURIComponent(workspaceId)}/documents/${encodeURIComponent(documentId)}/versions`;

// The list: newest first, without the content.
export const listVersionsRequest = (workspaceId, documentId) =>
  apiFetch(base(workspaceId, documentId));

// Saves the document's current text as a named version. data: { label? }
export const createVersionRequest = (workspaceId, documentId, data) =>
  apiFetch(base(workspaceId, documentId), { method: "POST", body: JSON.stringify(data) });

// One version WITH its content.
export const getVersionRequest = (workspaceId, documentId, number) =>
  apiFetch(`${base(workspaceId, documentId)}/${encodeURIComponent(number)}`);

// Puts an old version back. baseRevision is the revision your editor is on: if a
// teammate saved since, the server answers 409 and changes nothing.
export const restoreVersionRequest = (workspaceId, documentId, number, baseRevision) =>
  apiFetch(`${base(workspaceId, documentId)}/${encodeURIComponent(number)}/restore`, {
    method: "POST",
    body: JSON.stringify({ baseRevision }),
  });

export const deleteVersionRequest = (workspaceId, documentId, number) =>
  apiFetch(`${base(workspaceId, documentId)}/${encodeURIComponent(number)}`, { method: "DELETE" });