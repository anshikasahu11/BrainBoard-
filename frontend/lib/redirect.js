// Decides where to send a user after login, based on the ?next= address.
// Only paths on THIS site are allowed, which prevents "open redirect" attacks
// like /login?next=https://evil.com or /login?next=//evil.com
export function safeNext(value, fallback = "/workspaces") {
  if (typeof value !== "string") return fallback;

  // Must start with a single "/" (not "//" and not "/\")
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }

  // Never bounce back to the auth pages (that would loop)
  if (value.startsWith("/login") || value.startsWith("/register")) return fallback;

  return value;
}
