// A self-test for the notification screens' helpers: the wording, where a click leads, the list
// helpers and the time zone helpers. It needs no servers.
//
// Run it from the frontend folder:
//   node scripts/notifications-ui-check.mjs
//
// (Node may print a yellow warning about a "module type". That's harmless.)

import {
  addNotification,
  badgeText,
  bellLabel,
  markAllItemsRead,
  markItemRead,
  removeItem,
  unreadIn,
} from "../lib/notificationState.js";
import { notificationHref, notificationMessage } from "../lib/notificationText.js";
import { browserTimeZone, markerKey, needsSync, readMarker, writeMarker } from "../lib/timeZone.js";

let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `   (${detail})`}`);
  if (!ok) failures += 1;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log("Checking the notification screens' helpers\n");

const WS = "a".repeat(24);
const TASK = "b".repeat(24);
const make = (kind, extra = {}) => ({
  id: "c".repeat(24),
  kind,
  read: false,
  readAt: null,
  createdAt: "2026-11-13T10:00:00Z",
  actor: { id: "d".repeat(24), name: "Rahul" },
  workspace: { id: WS, name: "Acme Dev" },
  target: { type: "task", id: TASK, name: "Login API" },
  meta: {},
  ...extra,
});
const say = (kind, extra) => notificationMessage(make(kind, extra)).plain;
const anshika = { actor: { id: "e".repeat(24), name: "Anshika" }, target: { type: "workspace", id: WS, name: "Acme Dev" } };

// ---------- 1. The wording ----------
check("A task assigned to you", say("task.assigned") === "Rahul assigned you Login API");
check("...when nobody is named", say("task.assigned", { actor: null }) === "Someone assigned you Login API");
check(
  "Due soon says today, tomorrow, or just soon",
  say("task.due_soon", { actor: null, meta: { days: 0 } }) === "Login API is due today" &&
    say("task.due_soon", { actor: null, meta: { days: 1 } }) === "Login API is due tomorrow" &&
    say("task.due_soon", { actor: null, meta: {} }) === "Login API is due soon" &&
    say("task.due_soon", { actor: null, meta: { days: 7 } }) === "Login API is due soon"
);
check(
  "Overdue says how late",
  say("task.overdue", { actor: null, meta: { daysLate: 1 } }) === "Login API is overdue (due yesterday)" &&
    say("task.overdue", { actor: null, meta: { daysLate: 3 } }) === "Login API is overdue (due 3 days ago)" &&
    say("task.overdue", { actor: null, meta: {} }) === "Login API is overdue" &&
    say("task.overdue", { actor: null, meta: { daysLate: "many" } }) === "Login API is overdue"
);
check(
  "Being added says the role",
  say("member.added", { ...anshika, meta: { role: "admin" } }) === "Anshika added you to Acme Dev as an admin" &&
    say("member.added", { ...anshika, meta: { role: "member" } }) === "Anshika added you to Acme Dev as a member" &&
    say("member.added", { ...anshika, meta: {} }) === "Anshika added you to Acme Dev" &&
    say("member.added", { ...anshika, meta: { role: "wizard" } }) === "Anshika added you to Acme Dev"
);
check(
  "A role change says the new role",
  say("member.role_changed", { ...anshika, meta: { from: "member", role: "admin" } }) === "Anshika changed your role in Acme Dev to admin" &&
    say("member.role_changed", { ...anshika, meta: { role: "member" } }) === "Anshika changed your role in Acme Dev to member" &&
    say("member.role_changed", { ...anshika, meta: {} }) === "Anshika changed your role in Acme Dev"
);
check("Being removed", say("member.removed", anshika) === "Anshika removed you from Acme Dev");
check("A kind this screen doesn't know still says something sensible", say("robot.dance") === "Something happened in Acme Dev");
check(
  "A missing task or workspace name gets a fallback",
  say("task.assigned", { target: { type: "task", id: TASK } }) === "Rahul assigned you a task" &&
    say("member.removed", { workspace: { id: WS } }) === "Rahul removed you from a workspace" &&
    say("member.removed", { actor: { id: "x", name: "" } }) === "Someone removed you from Acme Dev"
);
check(
  "Names and titles are kept exactly as text, never changed or read as markup",
  say("task.assigned", { target: { type: "task", id: TASK, name: '<script>alert(1)</script> & "quotes"' } }) === 'Rahul assigned you <script>alert(1)</script> & "quotes"'
);

const assigned = notificationMessage(make("task.assigned"));
check(
  "The names and titles are marked for emphasis, and the words between them are not",
  same(assigned.segments.map((piece) => piece.strong), [true, false, true]) && same(notificationMessage(make("task.due_soon", { actor: null, meta: { days: 1 } })).segments.map((piece) => piece.strong), [true, false])
);
check(
  "The plain sentence is exactly the pieces joined",
  ["task.assigned", "task.due_soon", "task.overdue", "member.added", "member.role_changed", "member.removed", "other"].every((kind) => {
    const out = notificationMessage(make(kind, anshika));
    return out.plain === out.segments.map((piece) => piece.text).join("") && out.segments.every((piece) => typeof piece.text === "string" && piece.text.length > 0);
  })
);

// ---------- 2. Where a click leads ----------
const href = (kind, extra) => notificationHref(make(kind, extra));
check("A task notification opens that task on the board", href("task.assigned") === `/workspaces/${WS}/tasks?task=${TASK}` && href("task.due_soon") === `/workspaces/${WS}/tasks?task=${TASK}` && href("task.overdue") === `/workspaces/${WS}/tasks?task=${TASK}`);
check("Being added opens the workspace", href("member.added", anshika) === `/workspaces/${WS}`);
check("A role change opens the members page", href("member.role_changed", anshika) === `/workspaces/${WS}/members`);
check("Being removed leads nowhere", href("member.removed", anshika) === null);
check("A kind it doesn't know opens the workspace", href("robot.dance") === `/workspaces/${WS}`);
check("A task id that isn't an id falls back to the board", href("task.assigned", { target: { type: "task", id: "../x", name: "T" } }) === `/workspaces/${WS}/tasks` && href("task.assigned", { target: { type: "task", name: "T" } }) === `/workspaces/${WS}/tasks`);
check(
  "A workspace id that isn't an id leads nowhere, so nothing odd ever goes into an address",
  href("task.assigned", { workspace: { id: "../../x", name: "A" } }) === null && href("task.assigned", { workspace: { name: "A" } }) === null && href("task.assigned", { workspace: null }) === null && href("task.assigned", { workspace: { id: 5, name: "A" } }) === null
);

// ---------- 3. The list ----------
const item = (id, read = false) => ({ id, kind: "member.added", read, readAt: read ? "2026-11-13T09:00:00Z" : null });
const list = [item("c3"), item("c2", true), item("c1")];
const snapshot = JSON.stringify(list);

check("A new notification goes to the top", same(addNotification(list, item("c4")).map((entry) => entry.id), ["c4", "c3", "c2", "c1"]));
check("Out-of-order arrivals still end up in order", same(addNotification(list, item("c25")).map((entry) => entry.id), ["c3", "c25", "c2", "c1"]) && same(addNotification([], item("c1")).map((entry) => entry.id), ["c1"]));
check("One that's already there is replaced, not repeated", (() => { const out = addNotification(list, item("c3", true)); return out.length === 3 && out[0].read === true; })());
check("The list is capped", addNotification(Array.from({ length: 30 }, (_, i) => item(`n${String(i).padStart(2, "0")}`)), item("z")).length === 30 && addNotification(list, item("c4"), 2).length === 2 && addNotification(list, item("c4"), 2)[0].id === "c4");
check("Marking one read changes only that one", (() => { const out = markItemRead(list, "c3"); return out[0].read === true && out[0].readAt !== null && out[2].read === false && out[1].readAt === "2026-11-13T09:00:00Z"; })());
check("Marking an already-read one changes nothing, not even when read", markItemRead(list, "c2")[1].readAt === "2026-11-13T09:00:00Z" && same(markItemRead(list, "nope"), list));
check("Marking everything read", markAllItemsRead(list).every((entry) => entry.read) && markAllItemsRead(list)[1].readAt === "2026-11-13T09:00:00Z");
check("Removing one", same(removeItem(list, "c2").map((entry) => entry.id), ["c3", "c1"]) && removeItem(list, "nope").length === 3);
check("Counting the unread", unreadIn(list) === 2 && unreadIn([]) === 0 && unreadIn(markAllItemsRead(list)) === 0);
check("None of that ever changes the list it was given", JSON.stringify(list) === snapshot);

// ---------- 4. The badge and the bell's label ----------
check("The badge says nothing for none, the number up to 99, then 99+", badgeText(0) === "" && badgeText(1) === "1" && badgeText(9) === "9" && badgeText(10) === "10" && badgeText(99) === "99" && badgeText(100) === "99+" && badgeText(5000) === "99+");
check("The badge survives odd input", badgeText(-3) === "" && badgeText(NaN) === "" && badgeText(undefined) === "" && badgeText(null) === "" && badgeText("7") === "7" && badgeText(2.9) === "2");
check(
  "The bell is named for screen readers, with the count",
  bellLabel(0) === "Notifications" && bellLabel(1) === "Notifications, 1 unread" && bellLabel(12) === "Notifications, 12 unread" && bellLabel(100) === "Notifications, more than 99 unread" && bellLabel(undefined) === "Notifications"
);

// ---------- 5. The time zone ----------
check("A zone that was already sent isn't sent again", needsSync("Asia/Kolkata", "Asia/Kolkata") === false);
check("A new or changed zone is sent", needsSync(null, "Asia/Kolkata") === true && needsSync("UTC", "Asia/Kolkata") === true && needsSync(undefined, "UTC") === true);
check("No zone, nothing to send", needsSync(null, "") === false && needsSync("UTC", "") === false && needsSync(null, undefined) === false);
check("The reminder is kept per person", markerKey("u1") !== markerKey("u2") && markerKey("u1").includes("u1"));

const memory = new Map();
const storage = { getItem: (key) => (memory.has(key) ? memory.get(key) : null), setItem: (key, value) => memory.set(key, value) };
check("What was sent is remembered", readMarker(storage, "u1") === null && (writeMarker(storage, "u1", "Asia/Kolkata"), readMarker(storage, "u1") === "Asia/Kolkata") && readMarker(storage, "u2") === null);

const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
check("Blocked storage never breaks anything", readMarker(blocked, "u1") === null && (() => { try { writeMarker(blocked, "u1", "UTC"); return true; } catch { return false; } })());
check("The browser can say its time zone", typeof browserTimeZone() === "string");

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);