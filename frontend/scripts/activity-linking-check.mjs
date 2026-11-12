// A self-test for the "don't link this document" option, and for matching one
// document's history. It needs no servers.
//
// Run it from the frontend folder:
//   node scripts/activity-linking-check.mjs
//
// (Node may print a yellow warning about a "module type". That's harmless.)

import { describeActivity, matchesFilters, plainText } from "../lib/activityText.js";

let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `   (${detail})`}`);
  if (!ok) failures += 1;
}

const linked = { workspaceId: "w1", userId: "u1" };
const unlinked = { workspaceId: "w1", userId: "u1", linkTarget: false };

const entry = (action, targetType, targetName, meta = {}) => ({
  id: "x",
  action,
  category: targetType === "task" ? "tasks" : "documents",
  actor: { id: "u2", name: "Rahul" },
  target: { type: targetType, id: "t1", name: targetName },
  meta,
  createdAt: new Date().toISOString(),
});

const piece = (activity, context, text) =>
  describeActivity(activity, context).find((item) => item.text === text);

console.log("Checking the linking option\n");

const created = entry("document.created", "document", "Plan");
check(
  "By default a document's name links to its page",
  piece(created, linked, "Plan")?.href === "/workspaces/w1/documents/t1"
);
check(
  "With linkTarget off, the name is still bold, but not a link",
  piece(created, unlinked, "Plan")?.strong === true && piece(created, unlinked, "Plan")?.href === undefined
);
check(
  "The sentence reads exactly the same either way",
  plainText(describeActivity(created, linked)) === plainText(describeActivity(created, unlinked))
);

for (const action of ["document.updated", "version.restored", "version.deleted"]) {
  const item = entry(action, "document", "Plan", { number: 2 });
  check(
    `${action}: no link when linkTarget is off`,
    piece(item, unlinked, "Plan")?.href === undefined && piece(item, linked, "Plan")?.href !== undefined
  );
}

const saved = entry("version.saved", "document", "Plan", { number: 3, label: "RC" });
check(
  "A saved version still names its number and its label with linkTarget off",
  plainText(describeActivity(saved, unlinked)) === "Rahul saved version 3 of Plan (“RC”)",
  plainText(describeActivity(saved, unlinked))
);

const renamed = entry("document.renamed", "document", "Roadmap", { from: "Plan", to: "Roadmap" });
check(
  "A rename shows both names, and neither is a link when linkTarget is off",
  plainText(describeActivity(renamed, unlinked)) === "Rahul renamed Plan to Roadmap" &&
    describeActivity(renamed, unlinked).every((item) => item.href === undefined)
);

const task = entry("task.created", "task", "Login API");
check(
  "linkTarget off changes nothing for other kinds of entry",
  piece(task, unlinked, "Login API")?.href === "/workspaces/w1/tasks"
);

check(
  "One document's history matches only entries about that document",
  matchesFilters(created, { target: "t1" }, "u1") &&
    matchesFilters(saved, { target: "t1" }, "u1") &&
    !matchesFilters(created, { target: "t2" }, "u1")
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);