import { apiFetch } from "@/lib/api";

const base = (workspaceId) => `/api/workspaces/${encodeURIComponent(workspaceId)}/activity`;

// The feed, newest first. params: { category, actor, target, before, limit }. Empty ones are left out.
// `before` is the cursor from the previous page (nextCursor).
export const listActivityRequest = (workspaceId, params = {}) => {
  const query = new URLSearchParams();
  for (const name of ["category", "actor", "target", "before", "limit"]) {
    if (params[name]) query.set(name, String(params[name]));
  }

  const text = query.toString();
  return apiFetch(text ? `${base(workspaceId)}?${text}` : base(workspaceId));
};