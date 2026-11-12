// A self-test for the search helpers (scoring and excerpts). It needs no servers.
//
// Run it from the backend folder:
//   node scripts/search-text-check.mjs

import {
  bestMatch,
  contains,
  makeExcerpt,
  rank,
  tagScore,
  titleScore,
} from "../utils/searchText.js";

let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `   (${detail})`}`);
  if (!ok) failures += 1;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log("Checking the search helpers\n");

// 1. Scoring a title
check("An exact title match scores highest (100)", titleScore("Roadmap", "roadmap") === 100);
check("A title that starts with the search scores 80", titleScore("Roadmap notes", "road") === 80);
check("A match at the start of a later word scores 60", titleScore("Launch roadmap", "road") === 60);
check("A match inside a word scores 50", titleScore("Broadmap", "road") === 50 && titleScore("a1road", "road") === 50);
check("No match scores 0", titleScore("Budget", "road") === 0);
check("Matching ignores case", titleScore("ROADMAP", "roadmap") === 100 && titleScore("roadmap", "ROAD") === 80);
check("Empty text or an empty search scores 0", titleScore("", "a") === 0 && titleScore("a", "") === 0 && titleScore(null, "a") === 0);
check(
  "A match after punctuation counts as the start of a word",
  titleScore("Q3: roadmap", "roadmap") === 60 && titleScore("v2-roadmap", "roadmap") === 60
);

// 2. Tags and containing
check("An exact tag scores 45", tagScore(["auth", "jwt"], "jwt") === 45 && tagScore(["Auth"], "AUTH") === 45);
check("Part of a tag scores 35", tagScore(["javascript"], "java") === 35);
check("No matching tag, or no tags, scores 0", tagScore(["sql"], "jwt") === 0 && tagScore([], "jwt") === 0 && tagScore(undefined, "jwt") === 0);
check("contains() ignores case and rejects an empty search", contains("Hello World", "WORLD") && !contains("Hello", "") && !contains(null, "a"));

// 3. Picking the best field
check("The best-scoring field wins", same(bestMatch({ title: 50, text: 10 }), { field: "title", score: 50 }));
check("With nothing scored there is no best field", same(bestMatch({ title: 0, text: 0 }), { field: null, score: 0 }));

// 4. Ranking
const entries = [
  { score: 10, time: 5, item: "body-new" },
  { score: 80, time: 1, item: "title-old" },
  { score: 10, time: 9, item: "body-newest" },
  { score: 60, time: 3, item: "word" },
];
const ranked = rank(entries, 3);
check(
  "Best matches come first, then newer ones",
  same(ranked.items, ["title-old", "word", "body-newest"]),
  JSON.stringify(ranked.items)
);
check("hasMore says whether anything was left out", ranked.hasMore === true && rank(entries, 4).hasMore === false);
check("Ranking doesn't change the list it was given", entries[0].item === "body-new");
check("Nothing to rank gives an empty result", same(rank([], 5), { items: [], hasMore: false }));

// 5. Excerpts
check("A short text comes back whole, with no ellipsis", makeExcerpt("The quick brown fox", "brown") === "The quick brown fox");
check("Line breaks and extra spaces are squashed into single spaces", makeExcerpt("a\n\n b\t c", "b") === "a b c");
check("Empty text gives an empty excerpt", makeExcerpt("", "x") === "" && makeExcerpt(null, "x") === "");

const filler = "lorem ipsum ".repeat(30);
const middle = makeExcerpt(`${filler}NEEDLE${filler}`, "needle");
check(
  "A match in the middle gets an ellipsis on both sides, keeps its own case, and stays short",
  middle.startsWith("…") && middle.endsWith("…") && middle.includes("NEEDLE") && middle.length < 170,
  `${middle.length} characters`
);

const atStart = makeExcerpt(`NEEDLE ${"word ".repeat(100)}`, "needle");
check("A match at the very start has no leading ellipsis", !atStart.startsWith("…") && atStart.endsWith("…") && atStart.startsWith("NEEDLE"));

const atEnd = makeExcerpt(`${"word ".repeat(100)}NEEDLE`, "needle");
check("A match at the very end has no trailing ellipsis", atEnd.startsWith("…") && !atEnd.endsWith("…") && atEnd.endsWith("NEEDLE"));

const noMatch = makeExcerpt("x ".repeat(300), "needle");
check("With no match, you get the beginning of the text", noMatch.endsWith("…") && noMatch.length <= 142 && noMatch.startsWith("x x"));
check("Searching for nothing also gives the beginning", makeExcerpt("hello world", "") === "hello world");

// A property test: for many random texts, the excerpt is a real piece of the text, contains
// the match, is short, and never starts or ends in the middle of a word.
let seed = 12345;
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const words = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa", "lambda", "mu"];

let allGood = true;
let firstBad = "";
for (let run = 0; run < 300; run += 1) {
  const count = 5 + Math.floor(random() * 80);
  const list = Array.from({ length: count }, () => words[Math.floor(random() * words.length)]);
  list[Math.floor(random() * count)] = "NEEDLEWORD";
  const flat = list.join(" ");

  const excerpt = makeExcerpt(flat, "needleword");
  const inner = excerpt.replace(/^…/, "").replace(/…$/, "");
  const position = flat.indexOf(inner);

  const good =
    position !== -1 &&
    inner.includes("NEEDLEWORD") &&
    excerpt.length <= 160 &&
    (position === 0 || flat[position - 1] === " ") &&
    (position + inner.length === flat.length || flat[position + inner.length] === " ");

  if (!good && allGood) {
    allGood = false;
    firstBad = excerpt;
  }
}
check("300 random texts: excerpts are real, short, contain the match and cut cleanly", allGood, firstBad);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);