// The only place that touches the stored token.
// Every access is wrapped in try/catch, because browsers can block storage
// (private mode, strict settings) and the app should still load.

const KEY = "brainboard_token";

export function getToken() {
  if (typeof window === "undefined") return null; // running on the server
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    window.localStorage.setItem(KEY, token);
  } catch {
    // Storage unavailable: the user stays signed in until the page reloads.
  }
}

export function clearToken() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}