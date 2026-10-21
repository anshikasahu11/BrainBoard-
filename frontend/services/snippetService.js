import { apiFetch } from "@/lib/api";

const base = (workspaceId) => `/api/workspaces/${encodeURIComponent(workspaceId)}/snippets`;

// filters: { q, language, tag, limit }. Empty ones are left out.
export const listSnippetsRequest = (workspaceId, filters = {}) => {
  const params = new URLSearchParams();
  for (const name of ["q", "language", "tag", "limit"]) {
    if (filters[name]) params.set(name, String(filters[name]));
  }

  const query = params.toString();
  return apiFetch(query ? `${base(workspaceId)}?${query}` : base(workspaceId));
};

// Every tag used in the workspace, most used first.
export const listTagsRequest = (workspaceId) => apiFetch(`${base(workspaceId)}/tags`);

// One snippet WITH its full code (the list only carries a preview).
export const getSnippetRequest = (workspaceId, snippetId) =>
  apiFetch(`${base(workspaceId)}/${encodeURIComponent(snippetId)}`);

export const createSnippetRequest = (workspaceId, data) =>
  apiFetch(base(workspaceId), { method: "POST", body: JSON.stringify(data) });

// data: { baseRevision, ...only the fields that changed }.
// The server answers 409 if the revision is out of date (someone else saved first).
export const updateSnippetRequest = (workspaceId, snippetId, data) =>
  apiFetch(`${base(workspaceId)}/${encodeURIComponent(snippetId)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteSnippetRequest = (workspaceId, snippetId) =>
  apiFetch(`${base(workspaceId)}/${encodeURIComponent(snippetId)}`, { method: "DELETE" });