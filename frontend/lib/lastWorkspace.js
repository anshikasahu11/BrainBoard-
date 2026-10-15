// Remembers which workspace you opened last, so /workspaces can offer a
// "Continue" button. Wrapped in try/catch because browsers can block storage.

const KEY = "brainboard_last_workspace";

export function getLastWorkspace() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setLastWorkspace(id) {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // Storage unavailable. Nothing to remember.
  }
}

// Forget the stored workspace, but only if it's the one that went missing.
export function clearLastWorkspace(id) {
  try {
    if (!id || window.localStorage.getItem(KEY) === id) {
      window.localStorage.removeItem(KEY);
    }
  } catch {
    // Nothing to clear.
  }
}