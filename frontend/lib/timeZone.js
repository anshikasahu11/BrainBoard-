// Telling the server which time zone this browser is in, so reminders use the person's own
// "tomorrow". Plain JavaScript with no imports, so it can be tested alone.

// The browser's zone, like "Asia/Kolkata", or "" if it can't say.
export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

// What this browser last told the server is remembered per person, so nothing is sent on every page.
export const markerKey = (userId) => `brainboard_tz_${userId}`;

// Does the server need telling? Only when there is a zone and it isn't what was last sent.
export const needsSync = (lastSent, zone) => Boolean(zone) && lastSent !== zone;

// Storage can be blocked or full. These never throw.
export function readMarker(storage, userId) {
  try {
    return storage.getItem(markerKey(userId));
  } catch {
    return null;
  }
}

export function writeMarker(storage, userId, zone) {
  try {
    storage.setItem(markerKey(userId), zone);
  } catch {
    // Not remembering it just means asking again next time.
  }
}