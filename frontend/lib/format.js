export function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// "Oct 14, 2026, 10:42 AM", in the visitor's own time zone.
export function formatDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const UNITS = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

// "just now", "5 minutes ago", "yesterday", "2 weeks ago"...
export function formatRelative(iso) {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);

  // Under 45 seconds, or slightly in the future because of clock drift
  if (seconds > -45) return "just now";

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (-seconds >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return "just now";
}