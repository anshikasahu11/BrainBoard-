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

// "10:42 AM", in the visitor's own time zone.
export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// "Today", "Yesterday", or "Monday, October 12" (with the year if it isn't this year).
export function formatDayLabel(iso) {
  const date = new Date(iso);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  // Rounding keeps days with a clock change (23 or 25 hours) counted as one day.
  const daysAgo = Math.round((startOfToday - startOfDay) / 86400000);
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";

  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
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