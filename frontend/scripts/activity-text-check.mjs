// A self-test for the activity wording. It needs no servers.
//
// Run it from the frontend folder:
//   node scripts/activity-text-check.mjs
//
// (Node may print a yellow warning about a "module type". That's harmless.)

import {
  categoryLabel,
  describeActivity,
  groupByDay,
  matchesFilters,
  plainText,
} from "../lib/activityText.js";

let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `   (${detail})`}`);
  if (!ok) failures += 1;
}

const ctx = { workspaceId: "w1", userId: "u1" }; // "u1" is the person looking at the feed

// Builds an entry. Rahul (u2) did it, unless said otherwise.
const entry = (action, targetType, targetName, meta = {}, overrides = {}) => ({
  id: "x",
  action,
  category: "team",
  actor: { id: "u2", name: "Rahul" },
  target: { type: targetType, id: "t1", name: targetName },
  meta,
  createdAt: new Date().toISOString(),
  ...overrides,
});

const say = (activity) => plainText(describeActivity(activity, ctx));
const pieces = (activity) => describeActivity(activity, ctx);
const linkOf = (activity, text) => pieces(activity).find((piece) => piece.text === text)?.href;

console.log("Checking the activity wording\n");

// 1. Every kind of entry reads as a sentence
const cases = [
  [entry("workspace.created", "workspace", "Acme"), "Rahul created the workspace Acme"],
  [entry("workspace.renamed", "workspace", "B", { from: "A", to: "B" }), "Rahul renamed the workspace from A to B"],
  [entry("member.added", "member", "Priya", { role: "member" }), "Rahul added Priya as a member"],
  [entry("member.added", "member", "Priya", { role: "admin" }), "Rahul added Priya as an admin"],
  [entry("member.role_changed", "member", "Priya", { from: "member", role: "admin" }), "Rahul changed Priya’s role from Member to Admin"],
  [entry("member.removed", "member", "Priya"), "Rahul removed Priya"],
  [entry("member.left", "member", "Rahul"), "Rahul left the workspace"],
  [entry("document.created", "document", "Plan"), "Rahul created Plan"],
  [entry("document.renamed", "document", "Roadmap", { from: "Plan", to: "Roadmap" }), "Rahul renamed Plan to Roadmap"],
  [entry("document.updated", "document", "Plan"), "Rahul edited Plan"],
  [entry("document.deleted", "document", "Plan"), "Rahul deleted Plan"],
  [entry("version.saved", "document", "Plan", { number: 3, label: "RC" }), "Rahul saved version 3 of Plan (“RC”)"],
  [entry("version.saved", "document", "Plan", { number: 3, label: "" }), "Rahul saved version 3 of Plan"],
  [entry("version.restored", "document", "Plan", { number: 3 }), "Rahul restored version 3 of Plan"],
  [entry("version.deleted", "document", "Plan", { number: 3 }), "Rahul deleted version 3 of Plan"],
  [entry("task.created", "task", "Login API"), "Rahul created the task Login API"],
  [entry("task.moved", "task", "Login API", { from: "todo", to: "in_progress" }), "Rahul moved Login API from To do to In progress"],
  [entry("task.moved", "task", "Login API", { from: "review", to: "done" }), "Rahul moved Login API from Review to Done"],
  [entry("task.assigned", "task", "Login API", { assigneeId: "u3", assigneeName: "Priya" }), "Rahul assigned Login API to Priya"],
  [entry("task.unassigned", "task", "Login API"), "Rahul unassigned Login API"],
  [entry("task.updated", "task", "Login API"), "Rahul edited the task Login API"],
  [entry("task.deleted", "task", "Login API"), "Rahul deleted the task Login API"],
  [entry("snippet.created", "snippet", "Verify"), "Rahul saved the snippet Verify"],
  [entry("snippet.updated", "snippet", "Verify"), "Rahul edited the snippet Verify"],
  [entry("snippet.deleted", "snippet", "Verify"), "Rahul deleted the snippet Verify"],
];

for (const [activity, expected] of cases) {
  const actual = say(activity);
  check(`${activity.action}: "${expected}"`, actual === expected, actual);
}

// 2. "You" and "your"
const mine = { actor: { id: "u1", name: "Anshika" } };
check("Your own entries say 'You'", say(entry("task.created", "task", "Login API", {}, mine)) === "You created the task Login API");
check("Leaving the workspace as yourself", say(entry("member.left", "member", "Anshika", {}, mine)) === "You left the workspace");
check(
  "Being added is about 'you'",
  say(entry("member.added", "member", "Anshika", { role: "admin" }, { target: { type: "member", id: "u1", name: "Anshika" } })) ===
    "Rahul added you as an admin"
);
check(
  "Your role changing says 'your role'",
  say(entry("member.role_changed", "member", "Anshika", { from: "member", role: "admin" }, { target: { type: "member", id: "u1", name: "Anshika" } })) ===
    "Rahul changed your role from Member to Admin"
);
check(
  "Being assigned a task says 'to you'",
  say(entry("task.assigned", "task", "Login API", { assigneeId: "u1", assigneeName: "Anshika" })) ===
    "Rahul assigned Login API to you"
);

// 3. Links
check(
  "A document links to its page",
  linkOf(entry("document.created", "document", "Plan"), "Plan") === "/workspaces/w1/documents/t1"
);
check(
  "A deleted document has no link",
  linkOf(entry("document.deleted", "document", "Plan"), "Plan") === undefined
);
check(
  "A task links to the board",
  linkOf(entry("task.created", "task", "Login API"), "Login API") === "/workspaces/w1/tasks"
);
check(
  "A deleted task has no link",
  linkOf(entry("task.deleted", "task", "Login API"), "Login API") === undefined
);
check(
  "A snippet links to the snippets page",
  linkOf(entry("snippet.created", "snippet", "Verify"), "Verify") === "/workspaces/w1/snippets"
);
check(
  "A person links to the members page",
  linkOf(entry("member.added", "member", "Priya", { role: "member" }), "Priya") === "/workspaces/w1/members"
);
check(
  "The person who did it is never a link",
  pieces(entry("task.created", "task", "Login API"))[0].href === undefined
);

// 4. Odd or incomplete entries never crash
check(
  "An entry with no meta still reads sensibly",
  say({ ...entry("task.moved", "task", "Login API"), meta: undefined }).startsWith("Rahul moved Login API"),
  say({ ...entry("task.moved", "task", "Login API"), meta: undefined })
);
check(
  "A missing name gets a plain fallback",
  say(entry("document.created", "document", "")) === "Rahul created Untitled"
);
check(
  "An action this screen doesn't know is still described",
  say(entry("robot.dance", "document", "Plan")).includes("robot dance") &&
    say(entry("robot.dance", "document", "Plan")).includes("Plan")
);

// 5. Category names
check(
  "Categories have readable names",
  categoryLabel("documents") === "Documents" && categoryLabel("team") === "Team" && categoryLabel("zzz") === "Activity"
);

// 6. Grouping by day
const now = Date.now();
const grouped = groupByDay([
  { id: "1", createdAt: new Date(now).toISOString() },
  { id: "2", createdAt: new Date(now - 1000).toISOString() },
  { id: "3", createdAt: new Date(now - 24 * 60 * 60 * 1000).toISOString() },
  { id: "4", createdAt: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString() },
]);
check(
  "Entries are grouped by day, with Today and Yesterday",
  grouped.length === 3 &&
    grouped[0].label === "Today" &&
    grouped[0].items.length === 2 &&
    grouped[1].label === "Yesterday" &&
    grouped[1].items.length === 1 &&
    grouped[2].items.length === 1,
  JSON.stringify(grouped.map((group) => [group.label, group.items.length]))
);
check("No entries means no groups", groupByDay([]).length === 0);

// 7. Which live entries belong in a filtered list
const docEntry = entry("document.created", "document", "Plan", {}, { category: "documents" });
check("With no filters, every entry belongs", matchesFilters(docEntry, {}, "u1"));
check("The category filter matches and excludes", matchesFilters(docEntry, { category: "documents" }, "u1") && !matchesFilters(docEntry, { category: "tasks" }, "u1"));
check("'Only me' matches your own entries only", matchesFilters({ ...docEntry, actor: { id: "u1", name: "A" } }, { actor: "me" }, "u1") && !matchesFilters(docEntry, { actor: "me" }, "u1"));
check("A person filter matches that person only", matchesFilters(docEntry, { actor: "u2" }, "u1") && !matchesFilters(docEntry, { actor: "u9" }, "u1"));
check("A target filter matches that thing only", matchesFilters(docEntry, { target: "t1" }, "u1") && !matchesFilters(docEntry, { target: "t9" }, "u1"));

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);