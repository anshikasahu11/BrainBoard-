// A self-test for the task-review helpers. It needs no servers.
//
// Run it from the frontend folder:
//   node scripts/ai-tasks-ui-check.mjs
//
// (Node may print a yellow warning about a "module type". That's harmless.)

import {
  MAX_TITLE,
  addingMessage,
  countLabel,
  draftProblems,
  includedDrafts,
  titleProblem,
  toDrafts,
  toTaskPayload,
} from "../lib/taskDrafts.js";

let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `   (${detail})`}`);
  if (!ok) failures += 1;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log("Checking the task-review helpers\n");

const members = [
  { id: "r1", name: "Rahul" },
  { id: "p1", name: "Priya" },
];

// 1. From proposals to rows
const proposals = [
  { title: "Write the report", description: "By hand", priority: "high", dueDate: "2026-12-04", assignee: { id: "r1", name: "Rahul" } },
  { title: "Book the room", description: "", priority: "medium", dueDate: null, assignee: null },
];
const before = JSON.stringify(proposals);
const drafts = toDrafts(proposals, members);

check(
  "Each proposal becomes an editable row, all ticked, with its own key",
  drafts.length === 2 &&
    drafts.every((draft) => draft.include === true && draft.error === "") &&
    same(drafts.map((draft) => draft.key), ["p0", "p1"]) &&
    drafts[0].title === "Write the report" &&
    drafts[0].priority === "high" &&
    drafts[0].dueDate === "2026-12-04" &&
    drafts[0].assigneeId === "r1" &&
    drafts[1].assigneeId === "" &&
    drafts[1].dueDate === ""
);
check("The proposals themselves are never changed", JSON.stringify(proposals) === before);
check(
  "Someone who is no longer a member becomes 'Unassigned'",
  toDrafts([{ title: "a", assignee: { id: "gone", name: "Gone" } }], members)[0].assigneeId === ""
);
check(
  "With nobody to choose from, nobody is assigned",
  toDrafts([{ title: "a", assignee: { id: "r1", name: "Rahul" } }], [])[0].assigneeId === ""
);
check(
  "A missing or unknown priority becomes 'medium'",
  toDrafts([{ title: "a" }, { title: "b", priority: "critical" }, { title: "c", priority: 3 }], members).every((draft) => draft.priority === "medium")
);
check(
  "A missing or odd date becomes 'no date'",
  toDrafts([{ title: "a" }, { title: "b", dueDate: "tomorrow" }, { title: "c", dueDate: 20261204 }, { title: "d", dueDate: null }], members).every((draft) => draft.dueDate === "")
);
check(
  "Missing text fields become empty text",
  (() => {
    const row = toDrafts([{}], members)[0];
    return row.title === "" && row.description === "";
  })()
);
check("No proposals give no rows", same(toDrafts([], members), []));

// 2. Titles
check("A good title has no problem", titleProblem("Fix the login bug") === "");
check("A blank, spaces-only or missing title has a problem", titleProblem("") !== "" && titleProblem("    ") !== "" && titleProblem(null) !== "" && titleProblem(undefined) !== "");
check("A title of exactly 120 characters is fine, and one more is not", titleProblem("x".repeat(MAX_TITLE)) === "" && /120/.test(titleProblem("x".repeat(MAX_TITLE + 1))));
check("Spaces around a title don't count toward its length", titleProblem(`  ${"x".repeat(MAX_TITLE)}  `) === "");

// 3. What's ticked, and what's wrong
const mixed = [
  { key: "a", include: true, title: "Good" },
  { key: "b", include: true, title: "  " },
  { key: "c", include: false, title: "" },
  { key: "d", include: true, title: "y".repeat(500) },
];
check("Only ticked rows are included", same(includedDrafts(mixed).map((draft) => draft.key), ["a", "b", "d"]));
check(
  "Problems are reported only for ticked rows, by key",
  same(Object.keys(draftProblems(mixed)), ["b", "d"]) && draftProblems(mixed).a === undefined && draftProblems(mixed).c === undefined
);
check("A list with no problems reports none", same(draftProblems(drafts), {}));

// 4. What is sent to the server
const payload = toTaskPayload({ title: "  Write it  ", description: "  detail  ", priority: "high", assigneeId: "r1", dueDate: "2026-12-04" });
check("The payload is trimmed, and has exactly the fields the task endpoint takes", same(payload, { title: "Write it", description: "detail", priority: "high", assignee: "r1", dueDate: "2026-12-04" }));
check("The payload field order is stable", same(Object.keys(payload), ["title", "description", "priority", "assignee", "dueDate"]));
check(
  "Unassigned and no date become null, not empty text",
  (() => {
    const out = toTaskPayload({ title: "a", description: "", priority: "low", assigneeId: "", dueDate: "" });
    return out.assignee === null && out.dueDate === null;
  })()
);
check(
  "A bad priority or date is repaired, never sent",
  (() => {
    const out = toTaskPayload({ title: "a", description: "", priority: "banana", assigneeId: "", dueDate: "soon" });
    return out.priority === "medium" && out.dueDate === null;
  })()
);
check(
  "Nothing extra from the row (keys, errors, ticks) is sent",
  !("key" in payload) && !("include" in payload) && !("error" in payload) && !("assigneeId" in payload)
);

// 5. Words
check("Counting tasks", countLabel(1) === "1 task" && countLabel(0) === "0 tasks" && countLabel(5) === "5 tasks");
check("All added", addingMessage({ added: 5, failed: 0 }) === "Added 5 tasks." && addingMessage({ added: 1, failed: 0 }) === "Added 1 task.");
check("Some added, some failed", addingMessage({ added: 3, failed: 2 }) === "Added 3 tasks. 2 couldn’t be added.");
check("None added", addingMessage({ added: 0, failed: 1 }) === "Couldn’t add that task." && addingMessage({ added: 0, failed: 4 }) === "Couldn’t add any of the tasks.");
check("Nothing tried says nothing", addingMessage({ added: 0, failed: 0 }) === "");

// 6. A property test: whatever the rows hold, what's sent is always valid
let seed = 20261113;
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const junk = ["", "  ", "Task", "  padded  ", "x".repeat(200), "banana", "2026-12-04", "r1", "p1", "gone", null, 5];
const pick = () => junk[Math.floor(random() * junk.length)];

let safe = true;
let firstBad = "";
for (let run = 0; run < 400; run += 1) {
  const rows = Array.from({ length: 1 + Math.floor(random() * 10) }, (_, index) => ({
    key: `p${index}`,
    include: random() > 0.3,
    title: String(pick() ?? ""),
    description: String(pick() ?? ""),
    priority: pick(),
    dueDate: String(pick() ?? ""),
    assigneeId: String(pick() ?? ""),
    error: "",
  }));

  const problems = draftProblems(rows);
  const fine = includedDrafts(rows).filter((row) => !problems[row.key]);

  const good = fine.every((row) => {
    const out = toTaskPayload(row);
    return (
      out.title.length >= 1 &&
      out.title.length <= MAX_TITLE &&
      ["low", "medium", "high", "urgent"].includes(out.priority) &&
      (out.dueDate === null || /^\d{4}-\d{2}-\d{2}$/.test(out.dueDate)) &&
      (out.assignee === null || typeof out.assignee === "string") &&
      same(Object.keys(out), ["title", "description", "priority", "assignee", "dueDate"])
    );
  });

  if (!good && safe) {
    safe = false;
    firstBad = JSON.stringify(rows).slice(0, 200);
  }
}
check("400 random sets of rows: every payload that passes the checks is valid", safe, firstBad);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);