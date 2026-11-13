// Recent searches, kept in THIS browser only. The server never sees them.
// They're stored per person and per workspace, newest first, with no repeats.
// Everything is safe to call when storage is missing or broken (private browsing, a full
// disk, hand-edited data): you simply get no recent searches.
// Plain JavaScript with no app imports, so it can be tested on its own.

import { MIN_QUERY_LENGTH } from "./searchResults.js";

export const MAX_RECENT = 8;

const PREFIX = "brainboard:recent-searches:";
const keyFor = (userId, workspaceId) => `${PREFIX}v1:${userId}:${workspaceId}`;

// Squashes extra spaces and cuts to 100 characters, like the server does.
export function normalizeQuery(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 100).trim();
}

// ----- Pure list helpers (they never change the list you give them) -----

// Puts a search at the front. The same search written with other capitals is replaced, not repeated.
// Searches that are too short to run are ignored, and the very same list comes back.
export function addRecent(list, query, max = MAX_RECENT) {
  const clean = normalizeQuery(query);
  if (clean.length < MIN_QUERY_LENGTH) return list;

  const lowered = clean.toLowerCase();
  return [clean, ...list.filter((entry) => entry.toLowerCase() !== lowered)].slice(0, max);
}

export function removeRecent(list, query) {
  const lowered = normalizeQuery(query).toLowerCase();
  return list.filter((entry) => entry.toLowerCase() !== lowered);
}

// Turns whatever was stored into a clean list. Anything unexpected becomes [] or is dropped.
export function parseStored(raw, max = MAX_RECENT) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  const result = [];

  for (const entry of value) {
    if (typeof entry !== "string") continue;

    const clean = normalizeQuery(entry);
    const lowered = clean.toLowerCase();
    if (clean.length < MIN_QUERY_LENGTH || seen.has(lowered)) continue;

    seen.add(lowered);
    result.push(clean);
    if (result.length === max) break;
  }
  return result;
}

// ----- Reading and writing the browser's storage -----

const defaultStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // some browsers refuse access to storage altogether
  }
};

export function loadRecent(userId, workspaceId, storage = defaultStorage()) {
  if (!storage || !userId || !workspaceId) return [];

  try {
    return parseStored(storage.getItem(keyFor(userId, workspaceId)));
  } catch {
    return [];
  }
}

// Adds a search and saves the list. Returns the new list, even if saving wasn't possible.
export function saveRecentSearch(userId, workspaceId, query, storage = defaultStorage()) {
  const next = addRecent(loadRecent(userId, workspaceId, storage), query);

  if (storage && userId && workspaceId) {
    try {
      storage.setItem(keyFor(userId, workspaceId), JSON.stringify(next));
    } catch {
      // Storage is full or blocked: the search just isn't remembered.
    }
  }
  return next;
}

export function removeRecentSearch(userId, workspaceId, query, storage = defaultStorage()) {
  const next = removeRecent(loadRecent(userId, workspaceId, storage), query);

  if (storage && userId && workspaceId) {
    try {
      storage.setItem(keyFor(userId, workspaceId), JSON.stringify(next));
    } catch {
      // Nothing to do.
    }
  }
  return next;
}

// Forgets this person's recent searches in one workspace.
export function clearRecentSearches(userId, workspaceId, storage = defaultStorage()) {
  if (!storage || !userId || !workspaceId) return;

  try {
    storage.removeItem(keyFor(userId, workspaceId));
  } catch {
    // Nothing to do.
  }
}

// Forgets everyone's recent searches on this browser (used when logging out). Leaves anything
// else in storage alone.
export function clearAllRecentSearches(storage = defaultStorage()) {
  if (!storage) return;

  try {
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && key.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  } catch {
    // Nothing to do.
  }
}