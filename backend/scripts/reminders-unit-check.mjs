// A self-test for the reminder rules: time zones, dates, which reminder applies, and the plan.
// It needs no servers and no database.
//
// Run it from the backend folder:
//   node scripts/reminders-unit-check.mjs

import { KINDS, KIND_LIST } from "../constants/notifications.js";
import {
  OVERDUE_WINDOW_DAYS,
  addDays,
  candidateWindow,
  classify,
  daysBetween,
  isRealDate,
  isValidTimeZone,
  localDate,
  planReminders,
  reminderKey,
} from "../utils/reminderRules.js";

let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `   (${detail})`}`);
  if (!ok) failures += 1;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const at = (iso) => new Date(iso);

console.log("Checking the reminder rules\n");

// ---------- 1. The two new kinds ----------
check(
  "'Due soon' and 'Overdue' are notification kinds, with settings labels",
  KIND_LIST.includes("task.due_soon") &&
    KIND_LIST.includes("task.overdue") &&
    KINDS["task.due_soon"].label === "Tasks due soon" &&
    KINDS["task.overdue"].label === "Overdue tasks" &&
    KINDS["task.due_soon"].description.endsWith(".") &&
    KINDS["task.overdue"].description.endsWith(".")
);
check(
  "They go to members only, and aren't collapsed by time (a once-only key protects them)",
  KINDS["task.due_soon"].recipientMustBeMember === true &&
    KINDS["task.overdue"].recipientMustBeMember === true &&
    KINDS["task.due_soon"].throttleMs === 0 &&
    KINDS["task.overdue"].throttleMs === 0
);

// ---------- 2. Real dates ----------
check(
  "Real dates are told from impossible ones",
  isRealDate("2026-12-31") && isRealDate("2028-02-29") && !isRealDate("2027-02-29") && !isRealDate("2026-02-30") && !isRealDate("2026-13-01") && !isRealDate("2026-2-3") && !isRealDate("") && !isRealDate(null) && !isRealDate(20261231) && !isRealDate("2026-12-31T00:00:00Z")
);

// ---------- 3. Time zone names ----------
check(
  "Real zone names are accepted",
  ["UTC", "Asia/Kolkata", "America/New_York", "America/Argentina/Buenos_Aires", "Europe/London", "Pacific/Kiritimati", "Etc/GMT+5"].every(isValidTimeZone)
);
check(
  "Anything else is refused",
  ["", " ", "Mars/Olympus", "../etc/passwd", "Asia/Kolkata\n", " UTC", "UTC ", "+05:30", "Asia//Kolkata", "A".repeat(100), "Asia/Kolkata; DROP", "<script>", null, undefined, 5, {}, ["UTC"]].every((name) => !isValidTimeZone(name))
);

// ---------- 4. What the calendar says, in each zone ----------
check("UTC: 2030-06-15 20:00 is still June 15th", localDate("UTC", at("2030-06-15T20:00:00Z")) === "2030-06-15");
check("A missing zone, and an unknown one, mean UTC", localDate(undefined, at("2030-06-15T20:00:00Z")) === "2030-06-15" && localDate("Mars/Olympus", at("2030-06-15T20:00:00Z")) === "2030-06-15" && localDate(null, at("2030-06-15T20:00:00Z")) === "2030-06-15");
check(
  "Kolkata (UTC+5:30) is already on the next day at 18:30 UTC, and not a minute before",
  localDate("Asia/Kolkata", at("2030-06-15T18:30:00Z")) === "2030-06-16" && localDate("Asia/Kolkata", at("2030-06-15T18:29:00Z")) === "2030-06-15"
);
check(
  "Kathmandu (UTC+5:45) turns over at 18:15 UTC",
  localDate("Asia/Kathmandu", at("2030-06-15T18:15:00Z")) === "2030-06-16" && localDate("Asia/Kathmandu", at("2030-06-15T18:14:00Z")) === "2030-06-15"
);
check(
  "Kiritimati (UTC+14), the first place to see a new day",
  localDate("Pacific/Kiritimati", at("2030-06-15T10:00:00Z")) === "2030-06-16" && localDate("Pacific/Kiritimati", at("2030-06-15T09:59:00Z")) === "2030-06-15"
);
check(
  "Pago Pago (UTC-11), the last place to see a new day",
  localDate("Pacific/Pago_Pago", at("2030-06-15T11:00:00Z")) === "2030-06-15" && localDate("Pacific/Pago_Pago", at("2030-06-15T10:59:00Z")) === "2030-06-14"
);
check(
  "At the same instant, three places can be on three different dates",
  (() => {
    const instant = at("2030-06-15T11:30:00Z");
    return localDate("Pacific/Kiritimati", instant) === "2030-06-16" && localDate("UTC", instant) === "2030-06-15" && localDate("Pacific/Pago_Pago", instant) === "2030-06-15";
  })()
);
check(
  "Daylight saving: New York's day turns over an hour later after the clocks go back",
  localDate("America/New_York", at("2026-11-01T03:59:00Z")) === "2026-10-31" &&
    localDate("America/New_York", at("2026-11-01T04:00:00Z")) === "2026-11-01" &&
    localDate("America/New_York", at("2026-11-02T04:59:00Z")) === "2026-11-01" &&
    localDate("America/New_York", at("2026-11-02T05:00:00Z")) === "2026-11-02"
);
check(
  "Daylight saving: and the other way in spring",
  localDate("America/New_York", at("2026-03-08T06:59:00Z")) === "2026-03-08" && localDate("America/New_York", at("2026-03-09T03:59:00Z")) === "2026-03-08" && localDate("America/New_York", at("2026-03-09T04:00:00Z")) === "2026-03-09"
);
check("A leap day is a real day", localDate("UTC", at("2028-02-29T12:00:00Z")) === "2028-02-29");

// ---------- 5. Counting days ----------
check(
  "Days between two dates",
  daysBetween("2026-11-13", "2026-11-13") === 0 &&
    daysBetween("2026-11-13", "2026-11-14") === 1 &&
    daysBetween("2026-11-14", "2026-11-13") === -1 &&
    daysBetween("2026-01-31", "2026-02-01") === 1 &&
    daysBetween("2026-12-31", "2027-01-01") === 1 &&
    daysBetween("2026-01-01", "2027-01-01") === 365 &&
    daysBetween("2028-01-01", "2029-01-01") === 366
);
check("Leap years are handled: Feb 28 to Mar 1 is 2 days in 2028, and 1 day in 2027", daysBetween("2028-02-28", "2028-03-01") === 2 && daysBetween("2027-02-28", "2027-03-01") === 1);
check("Adding days crosses months, years and leap days", addDays("2026-12-31", 1) === "2027-01-01" && addDays("2028-03-01", -1) === "2028-02-29" && addDays("2026-11-13", 0) === "2026-11-13" && addDays("2026-11-13", -4) === "2026-11-09" && addDays("2026-11-30", 2) === "2026-12-02");

// ---------- 6. Which reminder applies ----------
check("The overdue window is 3 days", OVERDUE_WINDOW_DAYS === 3);
const today = "2030-06-16";
check("Due today is 'due soon' with 0 days", same(classify({ dueDate: "2030-06-16", today }), { kind: "task.due_soon", days: 0 }));
check("Due tomorrow is 'due soon' with 1 day", same(classify({ dueDate: "2030-06-17", today }), { kind: "task.due_soon", days: 1 }));
check("Due in 2 days or more is nothing yet", classify({ dueDate: "2030-06-18", today }) === null && classify({ dueDate: "2031-01-01", today }) === null);
check("1 day late is 'overdue'", same(classify({ dueDate: "2030-06-15", today }), { kind: "task.overdue", daysLate: 1 }));
check("3 days late is still 'overdue'", same(classify({ dueDate: "2030-06-13", today }), { kind: "task.overdue", daysLate: 3 }));
check("4 days late or more is nothing (too old to remind)", classify({ dueDate: "2030-06-12", today }) === null && classify({ dueDate: "2020-01-01", today }) === null);
check("A missing, impossible or odd date is nothing", classify({ dueDate: null, today }) === null && classify({ dueDate: "2030-02-30", today }) === null && classify({ dueDate: "soon", today }) === null && classify({ dueDate: "2030-06-16", today: "bad" }) === null && classify({}) === null);

// ---------- 7. The once-only key ----------
check("A key says the kind, the task and the due date", reminderKey("task.due_soon", "abc", "2030-06-16") === "task.due_soon:abc:2030-06-16");
check("A different due date is a different key, so moving a due date earns a new reminder", reminderKey("task.due_soon", "abc", "2030-06-16") !== reminderKey("task.due_soon", "abc", "2030-06-17"));
check("A different kind is a different key, so 'due soon' then 'overdue' are both sent", reminderKey("task.due_soon", "abc", "2030-06-16") !== reminderKey("task.overdue", "abc", "2030-06-16"));
check("A key fits the 120 characters the database allows", reminderKey("task.overdue", "a".repeat(24), "2030-06-16").length <= 120);

// ---------- 8. Which due dates are worth looking at ----------
check("The window runs from 4 days before today to 2 days after", same(candidateWindow(at("2026-11-13T12:00:00Z")), { from: "2026-11-09", to: "2026-11-15" }));
check("It crosses month and year ends", same(candidateWindow(at("2026-12-31T23:00:00Z")), { from: "2026-12-27", to: "2027-01-02" }));

// A property test: whatever the zone and the moment, any task that needs a reminder is inside the window.
const ZONES = ["UTC", "Pacific/Kiritimati", "Pacific/Pago_Pago", "Asia/Kolkata", "Asia/Kathmandu", "America/New_York", "America/Los_Angeles", "Europe/London", "Australia/Sydney", "Pacific/Auckland", "Pacific/Honolulu", "Pacific/Chatham"];
let seed = 20261113;
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const between = (min, max) => Math.floor(random() * (max - min + 1)) + min;

let covered = true;
let consistent = true;
let firstBad = "";
for (let run = 0; run < 600; run += 1) {
  const instant = new Date(Date.UTC(2026, 0, 1) + Math.floor(random() * 2 * 365 * 86400000));
  const zone = ZONES[between(0, ZONES.length - 1)];
  const localToday = localDate(zone, instant);
  const window = candidateWindow(instant);
  const dueDate = addDays(localToday, between(-10, 10));

  const verdict = classify({ dueDate, today: localToday });
  if (verdict && (dueDate < window.from || dueDate > window.to)) {
    covered = false;
    firstBad ||= `${zone} ${instant.toISOString()} due ${dueDate}`;
  }

  const difference = daysBetween(localToday, dueDate);
  const expected =
    difference === 0 || difference === 1 ? "task.due_soon" : difference < 0 && difference >= -3 ? "task.overdue" : null;
  if ((verdict?.kind ?? null) !== expected) consistent = false;

  // The local date is never more than a day away from the UTC date.
  if (Math.abs(daysBetween(instant.toISOString().slice(0, 10), localToday)) > 1) consistent = false;
}
check("600 random moments and zones: every task that needs a reminder is inside the search window", covered, firstBad);
check("600 random moments and zones: the right kind is chosen, and local dates are never more than a day from UTC", consistent);

// ---------- 9. The plan ----------
const now = at("2030-06-15T20:00:00Z"); // June 15th in UTC, June 16th in Kolkata
const people = new Map([
  ["uA", { timeZone: "Asia/Kolkata", muted: [] }],
  ["uB", { timeZone: undefined, muted: [] }],
  ["uC", { timeZone: "Mars/Olympus", muted: [] }],
  ["uD", { timeZone: "UTC", muted: ["task.due_soon"] }],
]);
const task = (id, assignee, dueDate, extra = {}) => ({ id, workspace: "w1", title: `Task ${id}`, priority: "high", assignee, status: "todo", dueDate, ...extra });

const tasks = [
  task("t1", "uA", "2030-06-16"), // Kolkata: today
  task("t2", "uB", "2030-06-16"), // UTC: tomorrow
  task("t3", "uC", "2030-06-16"), // unknown zone means UTC: tomorrow
  task("t4", "uD", "2030-06-16"), // due soon is muted
  task("t5", "uD", "2030-06-14"), // overdue is not muted
  task("t6", null, "2030-06-16"), // nobody's
  task("t7", "uA", "2030-06-16", { status: "done" }), // finished
  task("t8", "uA", null), // no date
  task("t9", "uZ", "2030-06-15"), // someone we know nothing about: UTC, due today
  task("t10", "uA", "2030-06-10"), // far too late
  task("t11", "uA", "2030-06-20"), // too far ahead
];
const snapshot = JSON.stringify(tasks);
const plan = planReminders({ tasks, people, now });

check("The plan has exactly the five reminders that apply", same(plan.map((item) => item.taskId), ["t5", "t9", "t1", "t2", "t3"]), plan.map((item) => item.taskId).join(","));
check("It is ordered by due date, then by key", plan.every((item, i) => i === 0 || plan[i - 1].dueDate < item.dueDate || (plan[i - 1].dueDate === item.dueDate && plan[i - 1].key < item.key)));

const byTask = Object.fromEntries(plan.map((item) => [item.taskId, item]));
check("The same due date is 'today' in Kolkata and 'tomorrow' in UTC", byTask.t1.meta.days === 0 && byTask.t2.meta.days === 1 && byTask.t1.dueDate === byTask.t2.dueDate);
check("An unknown zone is treated as UTC", byTask.t3.kind === "task.due_soon" && byTask.t3.meta.days === 1);
check("Someone with no settings is treated as UTC with nothing muted", byTask.t9.kind === "task.due_soon" && byTask.t9.meta.days === 0);
check("A muted kind is left out, but the person's other reminders stay", byTask.t4 === undefined && byTask.t5.kind === "task.overdue" && byTask.t5.meta.daysLate === 1);
check("Unassigned, finished, undated, too-late and too-far tasks get nothing", ["t6", "t7", "t8", "t10", "t11"].every((id) => byTask[id] === undefined));
check(
  "Each reminder has exactly these fields",
  plan.every((item) => same(Object.keys(item), ["userId", "taskId", "workspaceId", "title", "dueDate", "kind", "key", "meta"]) && item.key === reminderKey(item.kind, item.taskId, item.dueDate))
);
check("Its facts include the due date, how soon or late, and the priority", same(byTask.t1.meta, { dueDate: "2030-06-16", days: 0, priority: "high" }) && same(byTask.t5.meta, { dueDate: "2030-06-14", daysLate: 1, priority: "high" }));
check("A task with no priority is treated as medium", planReminders({ tasks: [task("t12", "uA", "2030-06-16", { priority: undefined })], people, now })[0].meta.priority === "medium");
check("Planning never changes what it was given", JSON.stringify(tasks) === snapshot);
check("Planning the same thing twice gives the same plan", same(planReminders({ tasks, people, now }), plan) && same(planReminders({ tasks: [...tasks].reverse(), people, now }), plan));
check("No tasks gives no plan", same(planReminders({ tasks: [], people, now }), []));
check(
  "A day later, everything moves along: due-today tasks become 'overdue', and the ones already sent have different keys",
  (() => {
    const later = planReminders({ tasks, people, now: at("2030-06-16T20:00:00Z") });
    const t1 = later.find((item) => item.taskId === "t1");
    return t1.kind === "task.overdue" && t1.meta.daysLate === 1 && t1.key !== byTask.t1.key;
  })()
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);