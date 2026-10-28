// A self-test for the comparison logic. It needs no servers.
//
// Run it from the frontend folder:
//   node scripts/diff-check.mjs
//
// (Node may print a yellow warning about a "module type". That's harmless.)

import {
  collapseEntries,
  compareDocuments,
  diffSequence,
  documentToLines,
} from "../lib/docDiff.js";

let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `   (${detail})`}`);
  if (!ok) failures += 1;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Small builders for documents
const text = (value) => ({ type: "text", text: value });
const para = (...kids) => ({
  type: "paragraph",
  content: kids.map((kid) => (typeof kid === "string" ? text(kid) : kid)),
});
const item = (...blocks) => ({ type: "listItem", content: blocks });
const doc = (...blocks) => ({ type: "doc", content: blocks });

console.log("Checking the comparison logic\n");

// 1. Turning a document into lines
const rich = doc(
  { type: "heading", attrs: { level: 2 }, content: [text("Title")] },
  para("Hello world"),
  {
    type: "bulletList",
    content: [
      item(para("One")),
      item(para("Two"), { type: "bulletList", content: [item(para("Two-a"))] }),
    ],
  },
  { type: "orderedList", attrs: { start: 1 }, content: [item(para("First")), item(para("Second"))] },
  {
    type: "taskList",
    content: [
      { type: "taskItem", attrs: { checked: true }, content: [para("Done")] },
      { type: "taskItem", attrs: { checked: false }, content: [para("Todo")] },
    ],
  },
  { type: "blockquote", content: [para("Quote")] },
  { type: "codeBlock", attrs: { language: "js" }, content: [text("a();\nb();")] },
  { type: "horizontalRule" },
  { type: "paragraph" } // an empty paragraph leaves no trace
);

const expectedLines = [
  "## Title",
  "Hello world",
  "• One",
  "• Two",
  "  • Two-a",
  "1. First",
  "2. Second",
  "[x] Done",
  "[ ] Todo",
  "> Quote",
  "```js",
  "a();",
  "b();",
  "```",
  "---",
];
const actualLines = documentToLines(rich);
check(
  "A document becomes readable lines (headings, lists, checkboxes, quotes, code)",
  same(actualLines, expectedLines),
  JSON.stringify(actualLines)
);

check(
  "Bold and links add nothing: only the words count",
  same(
    documentToLines(doc(para({ type: "text", text: "bold", marks: [{ type: "bold" }] }, " word"))),
    ["bold word"]
  ) || same(documentToLines(doc({ type: "paragraph", content: [{ type: "text", text: "bold", marks: [{ type: "bold" }] }, text(" word")] })), ["bold word"])
);
check(
  "A line break inside a paragraph becomes a space",
  same(documentToLines(doc(para("a", { type: "hardBreak" }, "b"))), ["a b"])
);
check("Empty or broken input gives no lines", documentToLines(null).length === 0 && documentToLines({}).length === 0);

// 2. Comparing lists
const ops = (a, b) => diffSequence(a, b)?.map((op) => `${op.type}:${op.value}`);

check(
  "A changed line is a removal followed by an addition",
  same(ops(["a", "b", "c"], ["a", "x", "c"]), ["equal:a", "remove:b", "add:x", "equal:c"]),
  JSON.stringify(ops(["a", "b", "c"], ["a", "x", "c"]))
);
check("An inserted line is only an addition", same(ops(["a", "c"], ["a", "b", "c"]), ["equal:a", "add:b", "equal:c"]));
check("A deleted line is only a removal", same(ops(["a", "b", "c"], ["a", "c"]), ["equal:a", "remove:b", "equal:c"]));
check("Identical lists show no changes", diffSequence(["a", "b"], ["a", "b"]).every((op) => op.type === "equal"));
check(
  "Two empty lists work",
  diffSequence([], []).length === 0 && same(ops([], ["a"]), ["add:a"]) && same(ops(["a"], []), ["remove:a"])
);

const bigA = Array.from({ length: 3000 }, (_, i) => `a${i}`);
const bigB = Array.from({ length: 3000 }, (_, i) => `b${i}`);
check("Two huge, completely different lists are refused instead of freezing", diffSequence(bigA, bigB) === null);

const longSame = Array.from({ length: 5000 }, (_, i) => `line ${i}`);
const longChanged = [...longSame];
longChanged[2500] = "changed";
check(
  "A single change in a long document is still found quickly",
  diffSequence(longSame, longChanged)?.filter((op) => op.type !== "equal").length === 2
);

// 3. Whole comparisons
const before = { title: "Plan", content: doc(para("The quick brown fox jumps"), para("Same line")) };
const after = { title: "Plan", content: doc(para("The quick red fox jumps"), para("Same line")) };
const reworded = compareDocuments(before, after);

check(
  "A reworded line shows as one line removed and one added",
  reworded.stats.added === 1 && reworded.stats.removed === 1 && !reworded.identical
);
const removedEntry = reworded.entries.find((entry) => entry.type === "remove");
const addedEntry = reworded.entries.find((entry) => entry.type === "add");
check(
  "The changed WORDS are marked inside the line",
  removedEntry?.parts?.some((part) => part.type === "remove" && part.text === "brown") &&
    addedEntry?.parts?.some((part) => part.type === "add" && part.text === "red"),
  JSON.stringify(reworded.entries)
);
check(
  "The unchanged words are kept in both lines",
  removedEntry?.parts?.some((part) => part.type === "equal" && part.text.includes("fox jumps")) &&
    addedEntry?.parts?.some((part) => part.type === "equal" && part.text.includes("The quick"))
);

const unrelated = compareDocuments(
  { title: "T", content: doc(para("Alpha beta")) },
  { title: "T", content: doc(para("Gamma delta")) }
);
check(
  "Unrelated lines aren't marked word by word",
  unrelated.entries.every((entry) => entry.parts === null) && unrelated.stats.added === 1 && unrelated.stats.removed === 1
);

const retitled = compareDocuments(
  { title: "Old title", content: doc(para("x")) },
  { title: "New title", content: doc(para("x")) }
);
check(
  "A changed title is reported on its own, not as a changed line",
  retitled.titleChanged?.from === "Old title" && retitled.titleChanged?.to === "New title" && !retitled.identical && retitled.stats.added === 0
);

const identical = compareDocuments(before, { ...before });
check("Identical documents are reported as identical", identical.identical && identical.stats.added === 0);

const structure = compareDocuments(
  { title: "T", content: doc(para("Groceries")) },
  { title: "T", content: doc({ type: "heading", attrs: { level: 2 }, content: [text("Groceries")] }) }
);
check(
  "Turning a paragraph into a heading counts as a change",
  structure.stats.added === 1 && structure.stats.removed === 1
);

// 4. Hiding unchanged lines
const lines = (marker) => [
  ...Array.from({ length: 10 }, (_, i) => para(`L${i}`)),
  para(marker),
  ...Array.from({ length: 10 }, (_, i) => para(`M${i}`)),
];
const long = compareDocuments(
  { title: "T", content: doc(...lines("X")) },
  { title: "T", content: doc(...lines("Y")) }
);
const collapsed = collapseEntries(long.entries, 2);
check(
  "Long stretches of unchanged text are collapsed to a few lines of context",
  collapsed.length === 8 &&
    collapsed[0].type === "gap" &&
    collapsed[0].count === 8 &&
    collapsed.at(-1).type === "gap" &&
    collapsed.at(-1).count === 8,
  JSON.stringify(collapsed.map((entry) => entry.type === "gap" ? `gap${entry.count}` : entry.type))
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);