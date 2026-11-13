// A self-test for the notifications page and settings helpers. It needs no servers.
//
// Run it from the frontend folder:
//   node scripts/notifications-page-check.mjs
//
// (Node may print a yellow warning about a "module type". That's harmless.)

import { MAX_PAGE, PAGE_SIZE, emptyCopy, loadedLimit, matchesFilters, mergePage, summaryText } from "../lib/notificationList.js";
import { describeZone, groupPreferences, supportedTimeZones, timeZoneOptions, zoneClock, zoneLabel } from "../lib/notificationSettings.js";

let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `   (${detail})`}`);
  if (!ok) failures += 1;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ids = (list) => list.map((item) => item.id);

console.log("Checking the notifications page and settings helpers\n");

// ---------- 1. Filters ----------
const note = (id, read = false, workspace = "w1") => ({ id, read, workspace: { id: workspace } });

check("With no filters, everything matches", matchesFilters(note("a", true)) && matchesFilters(note("a", false), {}) && matchesFilters(note("a"), { unread: false, workspace: "" }));
check("'Unread' skips the ones already read", !matchesFilters(note("a", true), { unread: true }) && matchesFilters(note("a", false), { unread: true }));
check("A workspace filter matches only that workspace", matchesFilters(note("a", false, "w1"), { workspace: "w1" }) && !matchesFilters(note("a", false, "w2"), { workspace: "w1" }));
check("Both filters must hold at once", !matchesFilters(note("a", true, "w1"), { unread: true, workspace: "w1" }) && !matchesFilters(note("a", false, "w2"), { unread: true, workspace: "w1" }) && matchesFilters(note("a", false, "w1"), { unread: true, workspace: "w1" }));
check("A notification with no workspace never matches a workspace filter", !matchesFilters({ id: "a", read: false }, { workspace: "w1" }) && matchesFilters({ id: "a", read: false }, {}));

// ---------- 2. Adding an older page ----------
const have = [note("c5"), note("c4")];
const snapshot = JSON.stringify(have);

check("An older page goes on the end", same(ids(mergePage(have, [note("c3"), note("c2")])), ["c5", "c4", "c3", "c2"]));
check("An overlapping page doesn't repeat anything", same(ids(mergePage(have, [note("c4"), note("c3")])), ["c5", "c4", "c3"]));
check("An empty page changes nothing", same(ids(mergePage(have, [])), ["c5", "c4"]) && same(ids(mergePage([], [note("c2"), note("c1")])), ["c2", "c1"]));
check("Out-of-order pages still end up newest first", same(ids(mergePage([note("c3")], [note("c9"), note("c1")])), ["c9", "c3", "c1"]));
check("The list it was given is never changed", JSON.stringify(have) === snapshot);

let seed = 20261113;
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pool = Array.from({ length: 40 }, (_, i) => `n${String(i).padStart(2, "0")}`);
const subset = () => pool.filter(() => random() > 0.6);

let tidy = true;
for (let run = 0; run < 300; run += 1) {
  const first = subset().map((id) => note(id));
  const second = subset().map((id) => note(id));
  const merged = mergePage(first, second);
  const union = new Set([...first, ...second].map((item) => item.id));

  const unique = new Set(ids(merged)).size === merged.length;
  const complete = merged.length === union.size && [...union].every((id) => ids(merged).includes(id));
  const sorted = merged.every((item, i) => i === 0 || merged[i - 1].id > item.id);
  if (!unique || !complete || !sorted) tidy = false;
}
check("300 random merges: never a repeat, never a loss, always newest first", tidy);

// ---------- 3. How many to ask for when refreshing ----------
check("A refresh asks for a page at least, and for as many as are showing", loadedLimit(0) === PAGE_SIZE && loadedLimit(5) === PAGE_SIZE && loadedLimit(20) === 20 && loadedLimit(35) === 35 && loadedLimit(100) === 100);
check("...but never more than the server allows", loadedLimit(500) === MAX_PAGE && loadedLimit(100000) === MAX_PAGE);
check("...and odd input gets the default", loadedLimit(NaN) === PAGE_SIZE && loadedLimit(undefined) === PAGE_SIZE && loadedLimit(-5) === PAGE_SIZE && loadedLimit(null) === PAGE_SIZE);

// ---------- 4. Words ----------
check(
  "The summary line",
  summaryText({ count: 1, hasMore: false, unread: false, everywhere: true }) === "1 notification" &&
    summaryText({ count: 0, hasMore: false, unread: false, everywhere: true }) === "0 notifications" &&
    summaryText({ count: 20, hasMore: true, unread: false, everywhere: true }) === "20+ notifications" &&
    summaryText({ count: 3, hasMore: false, unread: true, everywhere: false }) === "3 unread notifications in this workspace" &&
    summaryText({ count: 1, hasMore: false, unread: true, everywhere: true }) === "1 unread notification" &&
    summaryText({ count: 1, hasMore: true, unread: false, everywhere: true }) === "1+ notifications"
);

const empties = [emptyCopy({ unread: true, everywhere: true }), emptyCopy({ unread: true, everywhere: false }), emptyCopy({ unread: false, everywhere: true }), emptyCopy({ unread: false, everywhere: false })];
check("Each empty state has a title and a sentence", empties.every((copy) => copy.title.length > 3 && copy.text.length > 10));
check("...and the four are different from each other", new Set(empties.map((copy) => copy.title)).size === 4);

// ---------- 5. Settings sections ----------
const pref = (kind, enabled = true) => ({ kind, label: kind, description: "d", enabled });
const prefs = [pref("task.assigned"), pref("task.due_soon", false), pref("task.overdue"), pref("member.added"), pref("member.role_changed"), pref("member.removed")];
const before = JSON.stringify(prefs);
const groups = groupPreferences(prefs);

check("Settings are split into Tasks and Workspaces and roles, in order", same(groups.map((group) => group.label), ["Tasks", "Workspaces and roles"]) && same(groups.map((group) => group.items.length), [3, 3]));
check("Each section keeps its items in order", same(groups[0].items.map((item) => item.kind), ["task.assigned", "task.due_soon", "task.overdue"]) && same(groups[1].items.map((item) => item.kind), ["member.added", "member.role_changed", "member.removed"]));
check("A kind that fits nowhere goes in Other", same(groupPreferences([...prefs, pref("robot.dance")]).map((group) => group.label), ["Tasks", "Workspaces and roles", "Other"]));
check("Empty sections are left out", same(groupPreferences([pref("task.assigned")]).map((group) => group.label), ["Tasks"]) && same(groupPreferences([]), []));
check("The settings it was given are never changed", JSON.stringify(prefs) === before);
check("Every kind ends up in exactly one section", groups.flatMap((group) => group.items).length === prefs.length);

// ---------- 6. Time zones ----------
check("A zone is shown without underscores", zoneLabel("America/Argentina/Buenos_Aires") === "America/Argentina/Buenos Aires" && zoneLabel("UTC") === "UTC" && zoneLabel(null) === "" && zoneLabel(undefined) === "");
check(
  "The menu has UTC first, then the rest in order, with no repeats",
  same(timeZoneOptions(["Europe/London", "Asia/Kolkata", "Asia/Kolkata", "UTC"]), ["UTC", "Asia/Kolkata", "Europe/London"])
);
check(
  "The saved zone and the browser's are always on the menu, and blanks and junk are left out",
  same(timeZoneOptions(["Asia/Kolkata"], "Pacific/Chatham", "", null, 5, "  ", undefined, "Asia/Kolkata"), ["UTC", "Asia/Kolkata", "Pacific/Chatham"])
);
check("With no zones from the browser, there's still a menu", same(timeZoneOptions(undefined), ["UTC"]) && same(timeZoneOptions(null, "Asia/Kolkata"), ["UTC", "Asia/Kolkata"]));
check("This browser can list zones (or says none, safely)", Array.isArray(supportedTimeZones()));

const instant = new Date("2030-06-15T20:00:00Z");
check("The clock shows the time in a zone", /Sat.*20:00/.test(zoneClock("UTC", instant)) && /Sun.*01:30/.test(zoneClock("Asia/Kolkata", instant)), `${zoneClock("UTC", instant)} / ${zoneClock("Asia/Kolkata", instant)}`);
check("A zone that isn't known gives no clock", zoneClock("Mars/Olympus", instant) === "" && zoneClock("", instant) === "");

const unset = describeZone({ stored: null, browser: "Asia/Kolkata" });
const matching = describeZone({ stored: "Asia/Kolkata", browser: "Asia/Kolkata" });
const moved = describeZone({ stored: "UTC", browser: "Asia/Kolkata" });
check("No zone saved yet says UTC is used, and offers the browser's", /UTC/.test(unset.message) && unset.differs === true);
check("A saved zone that matches the browser needs nothing", matching.differs === false && /Reminders use this zone/.test(matching.message));
check("A saved zone that differs from the browser says so, and offers the browser's", moved.differs === true && /Asia\/Kolkata/.test(moved.message));
check("A browser that can't say its zone offers nothing", describeZone({ stored: "UTC", browser: "" }).differs === false && describeZone({ stored: null, browser: "" }).differs === false);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);