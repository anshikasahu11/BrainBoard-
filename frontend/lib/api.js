import { getToken, clearToken } from "@/lib/authStorage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// An error carrying the HTTP status and the backend's per-field messages.
export class ApiError extends Error {
  constructor(message, status = 0, errors) {
    super(message);
    this.name = "ApiError";
    this.status = status; // 0 means "couldn't reach the server"
    this.errors = errors; // e.g. { email: "Enter a valid email address" }
  }
}

export async function apiFetch(path, options = {}) {
  const token = getToken();

  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.");
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    // A rejected token means the session is over. Sign out everywhere.
    // (A wrong password on the login form is also a 401, so skip that one.)
    if (res.status === 401 && token && !path.startsWith("/api/auth/login")) {
      clearToken();
      window.dispatchEvent(new Event("auth:logout"));
    }
    throw new ApiError(
      data?.message || `Request failed (${res.status})`,
      res.status,
      data?.errors
    );
  }

  return data;
}