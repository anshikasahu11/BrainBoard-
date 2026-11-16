// Tells the server to end ONE login session, so a copy of its token stops working.
// It takes the token as an argument because by the time it runs, the browser has already
// forgotten it. It never throws and never keeps anyone waiting: it's sent in the background.
// Returns true if the server ended the session, and false if it couldn't be reached or refused.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export async function endSessionRequest(token) {
  if (typeof token !== "string" || token.length === 0) return false;

  try {
    const response = await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.ok;
  } catch {
    // Offline, or the server is down. The browser has still forgotten the token,
    // and it expires by itself.
    return false;
  }
}