// A self-test for the search window's helpers (highlighting, the result list, the shortcut).
// It needs no servers.
//
// Run it from the frontend folder:
//   node scripts/search-highlight-check.mjs
//
// (Node may print a yellow warning about a "module type". That's harmless.)

import {
  GROUPS,
  flattenResults,
  groupedOptions,
  highlightParts,
  isSearchShortcut,
  moveIndex,
  optionKey,
  resultHref,
} from "../lib/searchResults.js";

let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `   (${detail})`}`);
  if (!ok) failures += 1;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const joined = (parts) => parts.map((part) => part.text).join("");

console.log("Checking the search window's helpers\n");

// 1. Highlighting
check(
  "A match in the middle is marked, and the rest is left alone",
  same(highlightParts("Launch roadmap", "road"), [
    { text: "Launch ", match: false },
    { text: "road", match: true },
    { text: "map", match: false },
  ]),
  JSON.stringify(highlightParts("Launch roadmap", "road"))
);
check(
  "Case doesn't matter, and the text keeps its own case",
  same(highlightParts("ROADMAP notes", "roadmap"), [
    { text: "ROADMAP", match: true },
    { text: " notes", match: false },
  ])
);
check(
  "Every match is marked, not just the first",
  same(highlightParts("a-b-a", "a"), [
    { text: "a", match: true },
    { text: "-b-", match: false },
    { text: "a", match: true },
  ])
);
check("A match at the very start has no empty piece before it", highlightParts("road map", "road")[0].text === "road");
check("A match at the very end has no empty piece after it", highlightParts("map road", "road").at(-1).text === "road");
check(
  "Matches next to each other don't overlap",
  same(highlightParts("aaaa", "aa"), [
    { text: "aa", match: true },
    { text: "aa", match: true },
  ])
);
check(
  "No match gives the whole text, unmarked",
  same(highlightParts("Budget", "road"), [{ text: "Budget", match: false }])
);
check(
  "An empty search marks nothing",
  same(highlightParts("Budget", ""), [{ text: "Budget", match: false }]) &&
    same(highlightParts("Budget", "   "), [{ text: "Budget", match: false }]) &&
    same(highlightParts("Budget", null), [{ text: "Budget", match: false }])
);
check("Empty or missing text gives no pieces", highlightParts("", "a").length === 0 && highlightParts(null, "a").length === 0);
check(
  "A search longer than the text just doesn't match",
  same(highlightParts("ab", "abcdef"), [{ text: "ab", match: false }])
);

// 2. Special characters mean nothing special
check(
  "Parentheses are matched literally",
  same(highlightParts("price (draft)", "(draft)"), [
    { text: "price ", match: false },
    { text: "(draft)", match: true },
  ])
);
check(
  "'.*' matches only those two characters, not everything",
  same(highlightParts("a.*b", ".*"), [
    { text: "a", match: false },
    { text: ".*", match: true },
    { text: "b", match: false },
  ])
);
check(
  "Brackets and backslashes are harmless",
  joined(highlightParts("x [a] \\ y", "[a] \\")) === "x [a] \\ y" &&
    highlightParts("x [a] \\ y", "[a] \\").some((part) => part.match)
);

// 3. Characters that change length when lowercased
const turkish = highlightParts("İstanbul", "stan");
check(
  "Text whose lowercase is a different length can't throw the highlight off",
  joined(turkish) === "İstanbul" && same(turkish.find((part) => part.match), { text: "stan", match: true }),
  JSON.stringify(turkish)
);
check(
  "...and also never crashes when it can't match",
  joined(highlightParts("İstanbul", "STAN")) === "İstanbul"
);
check("Accented text is matched like any other", highlightParts("Café menu", "café").some((part) => part.match));

// 4. A property test: random texts and searches
let seed = 987654;
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const alphabet = "abcABC (.*)[]\\-_ xyz";
const randomText = (length) => Array.from({ length }, () => alphabet[Math.floor(random() * alphabet.length)]).join("");

let allGood = true;
let firstBad = "";
for (let run = 0; run < 500; run += 1) {
  const text = randomText(Math.floor(random() * 60));
  const needle = randomText(1 + Math.floor(random() * 3)).trim() || "a";
  const parts = highlightParts(text, needle);

  const good =
    joined(parts) === text &&
    parts.every((part) => part.text.length > 0) &&
    parts.every((part) => !part.match || part.text.toLowerCase() === needle.toLowerCase());

  if (!good && allGood) {
    allGood = false;
    firstBad = JSON.stringify({ text, needle, parts });
  }
}
check(
  "500 random texts: the pieces always join back to the original, and every marked piece really matches",
  allGood,
  firstBad
);

// 5. Links
check(
  "A document links to its own page",
  resultHref("document", { id: "d1" }, "w1") === "/workspaces/w1/documents/d1"
);
check(
  "Tasks, snippets and people link to the page they live on",
  resultHref("task", { id: "t1" }, "w1") === "/workspaces/w1/tasks" &&
    resultHref("snippet", { id: "s1" }, "w1") === "/workspaces/w1/snippets" &&
    resultHref("member", { id: "m1" }, "w1") === "/workspaces/w1/members"
);
check("An unknown kind falls back to the dashboard", resultHref("robot", { id: "x" }, "w1") === "/workspaces/w1");

// 6. One list for the keyboard
const results = {
  documents: { items: [{ id: "d1", title: "A" }, { id: "d2", title: "B" }], hasMore: true },
  tasks: { items: [], hasMore: false },
  snippets: { items: [{ id: "s1", title: "C" }], hasMore: false },
  members: { items: [{ id: "m1", title: "D" }], hasMore: false },
};
const options = flattenResults(results, "w1");

check("The groups are in display order", same(GROUPS.map((group) => group.key), ["documents", "tasks", "snippets", "members"]));
check(
  "Results become one list: documents, then snippets, then people (the empty group leaves no gap)",
  same(options.map((option) => option.type), ["document", "document", "snippet", "member"])
);
check(
  "Each entry carries its link",
  options[0].href === "/workspaces/w1/documents/d1" && options[2].href === "/workspaces/w1/snippets"
);
check(
  "Missing or empty results give an empty list",
  flattenResults(undefined, "w1").length === 0 && flattenResults({}, "w1").length === 0
);

const groups = groupedOptions(options, results);
check(
  "Groups are drawn without the empty one, with continuous positions for the keyboard",
  same(groups.map((group) => group.key), ["documents", "snippets", "members"]) &&
    same(groups[0].entries.map((entry) => entry.index), [0, 1]) &&
    same(groups[1].entries.map((entry) => entry.index), [2]) &&
    same(groups[2].entries.map((entry) => entry.index), [3])
);
check("A group that has more than it shows says so", groups[0].hasMore === true && groups[1].hasMore === false);

const keys = options.map(optionKey);
check("Every entry has its own key", new Set(keys).size === keys.length && keys[0] === "document:d1");

// 7. Moving the highlight
check("Down from nothing goes to the first", moveIndex(-1, 1, 3) === 0);
check("Up from nothing goes to the last", moveIndex(-1, -1, 3) === 2);
check("Down from the last wraps to the first", moveIndex(2, 1, 3) === 0);
check("Up from the first wraps to the last", moveIndex(0, -1, 3) === 2);
check("Ordinary moves work", moveIndex(1, 1, 3) === 2 && moveIndex(1, -1, 3) === 0);
check("An empty list has nothing to highlight", moveIndex(0, 1, 0) === -1 && moveIndex(-1, -1, 0) === -1);

// 8. The shortcut
const press = (key, extra = {}) => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra });
check("Ctrl + K is the shortcut", isSearchShortcut(press("k", { ctrlKey: true })));
check("Cmd + K is the shortcut", isSearchShortcut(press("k", { metaKey: true })));
check("Caps Lock (a capital K) still counts", isSearchShortcut(press("K", { ctrlKey: true })));
check("K alone is not the shortcut", !isSearchShortcut(press("k")));
check("Another key with Ctrl is not the shortcut", !isSearchShortcut(press("j", { ctrlKey: true })));
check(
  "With Shift or Alt it's left for other uses",
  !isSearchShortcut(press("k", { ctrlKey: true, shiftKey: true })) &&
    !isSearchShortcut(press("k", { ctrlKey: true, altKey: true }))
);
check("A missing event or key never crashes", !isSearchShortcut(undefined) && !isSearchShortcut({ ctrlKey: true }));

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);