import { DEFAULT_PAGE, KINDS, KIND_LIST, MAX_PAGE } from "../constants/notifications.js";

// The rules for notifications, as plain functions with no database, so they can be tested alone.

// Object.hasOwn means names like "constructor" or "__proto__" are never "known kinds".
export const isKnownKind = (kind) => typeof kind === "string" && Object.hasOwn(KINDS, kind);

// Should this person be notified at all? `muted` is the list of kinds they switched off.
// Returns { send: true } or { send: false, reason }.
export function decide({ kind, recipientId, actorId, muted = [] }) {
  if (!isKnownKind(kind)) return { send: false, reason: "unknown_kind" };
  if (!recipientId) return { send: false, reason: "no_recipient" };
  if (String(recipientId) === String(actorId)) return { send: false, reason: "self" };
  if (Array.isArray(muted) && muted.includes(kind)) return { send: false, reason: "muted" };
  return { send: true, reason: null };
}

// Anything created after this moment counts as a repeat, or null if this kind never collapses.
export function throttleCutoff(kind, now = new Date()) {
  const ms = KINDS[kind]?.throttleMs ?? 0;
  return ms > 0 ? new Date(now.getTime() - ms) : null;
}

// How many to return: a whole number from 1 to the maximum, or the default if it's not a number.
export function pageSize(value) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return DEFAULT_PAGE;
  return Math.min(Math.max(number, 1), MAX_PAGE);
}

// Every kind with its label and whether it's on for this person. `muted` lists the switched-off
// kinds. Anything in it that isn't a real kind is ignored.
export function preferenceList(muted = []) {
  const off = new Set(Array.isArray(muted) ? muted : []);

  return KIND_LIST.map((kind) => ({
    kind,
    label: KINDS[kind].label,
    description: KINDS[kind].description,
    enabled: !off.has(kind),
  }));
}

// Only small, plain facts are kept: text, numbers, true/false and null.
export function cleanNotificationMeta(meta) {
  const clean = {};

  for (const [key, value] of Object.entries(meta ?? {}).slice(0, 8)) {
    if (typeof value === "string") clean[key] = value.slice(0, 120);
    else if (typeof value === "number" && Number.isFinite(value)) clean[key] = value;
    else if (typeof value === "boolean" || value === null) clean[key] = value;
  }
  return clean;
}