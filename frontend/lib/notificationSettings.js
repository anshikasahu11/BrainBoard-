// Helpers for the notification settings page. Plain JavaScript with no imports, so it can be
// tested alone.

const GROUPS = [
  { key: "task", label: "Tasks" },
  { key: "member", label: "Workspaces and roles" },
];

// Splits the settings into sections by the start of each kind ("task.assigned" is a task one).
// Anything that fits no section goes in "Other". Empty sections are left out.
export function groupPreferences(preferences) {
  const groups = GROUPS.map((group) => ({
    ...group,
    items: preferences.filter((item) => item.kind.startsWith(`${group.key}.`)),
  }));

  const placed = new Set(groups.flatMap((group) => group.items.map((item) => item.kind)));
  const other = preferences.filter((item) => !placed.has(item.kind));
  if (other.length > 0) groups.push({ key: "other", label: "Other", items: other });

  return groups.filter((group) => group.items.length > 0);
}

// "America/Argentina/Buenos_Aires" -> "America/Argentina/Buenos Aires"
export const zoneLabel = (zone) => String(zone ?? "").replaceAll("_", " ");

// The time zone names this browser knows (empty on a very old browser).
export function supportedTimeZones() {
  try {
    return typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  } catch {
    return [];
  }
}

// The choices for the time zone menu: UTC first, then the rest in order, with no repeats and
// no blanks. `extra` is for zones that must be there even if the browser doesn't list them
// (the saved one, the browser's own).
export function timeZoneOptions(supported, ...extra) {
  const names = [...(Array.isArray(supported) ? supported : []), ...extra].filter(
    (name) => typeof name === "string" && name.trim() !== "" && name !== "UTC"
  );

  return ["UTC", ...[...new Set(names)].sort()];
}

// What the time is in a zone right now, like "Sun 01:30", or "" if the zone isn't known.
export function zoneClock(zone, now = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);
  } catch {
    return "";
  }
}

// Says how the saved zone relates to the browser's, and whether offering "use my browser's" makes sense.
export function describeZone({ stored, browser }) {
  if (!stored) {
    return { message: "Not set yet, so reminders use UTC.", differs: Boolean(browser) };
  }
  if (!browser || stored === browser) {
    return { message: "Reminders use this zone.", differs: false };
  }
  return { message: `Your browser says you’re in ${zoneLabel(browser)}.`, differs: true };
}