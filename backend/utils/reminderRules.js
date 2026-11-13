// The rules for due-date reminders, as plain functions with no database, so they can be tested alone.

// "Overdue" reminders stop after this many days late. A task that's been overdue for weeks is
// already visible on the dashboard, and this stops a flood the first time the job runs.
export const OVERDUE_WINDOW_DAYS = 3;

// "2026-12-31": the right shape AND a real calendar day (no February 30th).
export function isRealDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// ---------- Time zones ----------

// The shape of a real zone name: "UTC", "Asia/Kolkata", "America/Argentina/Buenos_Aires", "Etc/GMT+5".
const ZONE_SHAPE = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/;

// Is this a time zone name the system knows? Strict: no spaces, no odd characters, not too long.
export function isValidTimeZone(name) {
  if (typeof name !== "string" || name.length > 64 || !ZONE_SHAPE.test(name)) return false;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

const formatters = new Map();

function formatterFor(zone) {
  let formatter = formatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
    formatters.set(zone, formatter);
  }
  return formatter;
}

// What the calendar says in `timeZone` at the moment `now`, as "YYYY-MM-DD".
// A missing or unknown zone means UTC.
export function localDate(timeZone, now = new Date()) {
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const parts = formatterFor(zone).formatToParts(now);
  const pick = (type) => parts.find((part) => part.type === type).value;

  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

// ---------- Plain dates ----------

const toDay = (iso) => {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
};

// How many days from `fromIso` to `toIso` (negative if it's earlier).
export const daysBetween = (fromIso, toIso) => Math.round(toDay(toIso) - toDay(fromIso));

export const addDays = (iso, days) => new Date((toDay(iso) + days) * 86400000).toISOString().slice(0, 10);

// ---------- What kind of reminder, if any ----------

// Given a due date and what "today" is for the person:
//   due today or tomorrow           -> { kind: "task.due_soon", days: 0 | 1 }
//   1 to 3 days past the due date   -> { kind: "task.overdue", daysLate: 1..3 }
//   anything else                   -> null
export function classify({ dueDate, today }) {
  if (!isRealDate(dueDate) || !isRealDate(today)) return null;

  const difference = daysBetween(today, dueDate);
  if (difference === 0 || difference === 1) return { kind: "task.due_soon", days: difference };
  if (difference < 0 && difference >= -OVERDUE_WINDOW_DAYS) return { kind: "task.overdue", daysLate: -difference };
  return null;
}

// The once-only key. The due date is part of it, so moving a task's due date earns new reminders.
export const reminderKey = (kind, taskId, dueDate) => `${kind}:${taskId}:${dueDate}`;

// The range of due dates worth looking at. Anywhere on Earth, "today" is within a day of today in
// UTC, so this covers every time zone: from the longest overdue window to two days ahead.
export function candidateWindow(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return { from: addDays(today, -(1 + OVERDUE_WINDOW_DAYS)), to: addDays(today, 2) };
}

// Works out which reminders are due right now. No database: everything it needs is passed in.
//   tasks:  [{ id, workspace, title, priority, assignee, status, dueDate }]
//   people: Map of userId -> { timeZone, muted }. Someone missing from it is in UTC with nothing muted.
// Returns the reminders, oldest due date first (then by key, so the order never changes).
export function planReminders({ tasks, people, now = new Date() }) {
  const plan = [];

  for (const task of tasks) {
    if (!task.assignee || task.status === "done" || !task.dueDate) continue;

    const person = people.get(String(task.assignee)) ?? {};
    const verdict = classify({ dueDate: task.dueDate, today: localDate(person.timeZone, now) });
    if (!verdict) continue;

    // A muted kind is left out here, so nothing is recorded and it isn't "used up".
    if (Array.isArray(person.muted) && person.muted.includes(verdict.kind)) continue;

    const priority = task.priority ?? "medium";
    plan.push({
      userId: String(task.assignee),
      taskId: String(task.id),
      workspaceId: String(task.workspace),
      title: task.title,
      dueDate: task.dueDate,
      kind: verdict.kind,
      key: reminderKey(verdict.kind, task.id, task.dueDate),
      meta:
        verdict.kind === "task.due_soon"
          ? { dueDate: task.dueDate, days: verdict.days, priority }
          : { dueDate: task.dueDate, daysLate: verdict.daysLate, priority },
    });
  }

  return plan.sort((a, b) => {
    if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    if (a.key !== b.key) return a.key < b.key ? -1 : 1;
    return 0;
  });
}