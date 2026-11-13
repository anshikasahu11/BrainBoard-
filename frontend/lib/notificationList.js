// Helpers for the full notifications list. They never change what they're given: each returns
// a new list. Plain JavaScript with no imports, so it can be tested alone.

export const PAGE_SIZE = 20;
export const MAX_PAGE = 100; // the most the server returns in one go

// Does a notification belong in a list with these filters?
//   unread:    only ones not yet read.   workspace: only ones from this workspace id ("" = all).
export function matchesFilters(notification, { unread = false, workspace = "" } = {}) {
  if (unread && notification.read) return false;
  if (workspace && notification.workspace?.id !== workspace) return false;
  return true;
}

// Adds an OLDER page to the end of the list, with no repeats, newest first. Ids grow over time,
// so sorting by id is sorting by age.
export function mergePage(items, page) {
  const have = new Set(items.map((item) => item.id));
  const merged = [...items, ...page.filter((item) => !have.has(item.id))];

  return merged.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}

// How many to ask for when refreshing: at least a page, and as many as are already showing,
// so a refresh doesn't throw away the pages someone loaded.
export function loadedLimit(loaded) {
  const count = Number.isFinite(loaded) ? loaded : 0;
  return Math.min(MAX_PAGE, Math.max(PAGE_SIZE, count));
}

// The line above the list: "20+ notifications", "3 unread notifications in this workspace".
export function summaryText({ count, hasMore, unread, everywhere }) {
  const noun = count === 1 && !hasMore ? "notification" : "notifications";
  const number = hasMore ? `${count}+` : String(count);

  return `${number} ${unread ? "unread " : ""}${noun}${everywhere ? "" : " in this workspace"}`;
}

// What to say when the list is empty, depending on the filters.
export function emptyCopy({ unread, everywhere }) {
  if (unread && everywhere) {
    return { title: "Nothing unread", text: "You’re all caught up in every workspace." };
  }
  if (unread) {
    return { title: "Nothing unread here", text: "You’re all caught up in this workspace." };
  }
  if (everywhere) {
    return { title: "No notifications yet", text: "Things that need your attention will show up here." };
  }
  return { title: "No notifications in this workspace", text: "Try “All workspaces” to see everything." };
}