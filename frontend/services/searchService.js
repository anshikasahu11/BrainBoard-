import { apiFetch } from "@/lib/api";

// Searches one workspace. The server returns grouped results:
//   { query, results: { documents: { items, hasMore }, tasks: ..., snippets: ..., members: ... } }
// Each item has a title, a short plain-text excerpt and which field matched, never whole content.
export const searchWorkspaceRequest = (workspaceId, q, { types, limit } = {}) => {
  const params = new URLSearchParams({ q });
  if (types) params.set("types", types);
  if (limit) params.set("limit", String(limit));

  return apiFetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/search?${params}`);
};