import { apiFetch } from "@/lib/api";

const base = "/api/notifications";

// Notifications belong to the signed-in person, not a workspace.
// Filters: unread (true), workspace (an id). Paging: limit, before (a cursor from the last page).
export function listNotificationsRequest({ limit = 15, before, unread, workspace } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set("before", before);
  if (unread) params.set("unread", "true");
  if (workspace) params.set("workspace", workspace);

  return apiFetch(`${base}?${params}`);
}

export const getUnreadCountRequest = () => apiFetch(`${base}/unread-count`);

// Safe to repeat: reading something already read just says so.
export const markReadRequest = (id) => apiFetch(`${base}/${encodeURIComponent(id)}/read`, { method: "POST" });

export const markAllReadRequest = () => apiFetch(`${base}/read-all`, { method: "POST" });

// Dismisses it for this person only.
export const deleteNotificationRequest = (id) =>
  apiFetch(`${base}/${encodeURIComponent(id)}`, { method: "DELETE" });

// Every kind with whether it's on, plus the person's time zone.
export const getPreferencesRequest = () => apiFetch(`${base}/preferences`);

export const setPreferenceRequest = (kind, enabled) =>
  apiFetch(`${base}/preferences/${encodeURIComponent(kind)}`, {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });

// Reminders use it to know what "today" and "tomorrow" mean for this person.
export const setTimeZoneRequest = (timeZone) =>
  apiFetch(`${base}/time-zone`, { method: "PUT", body: JSON.stringify({ timeZone }) });