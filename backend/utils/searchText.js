// Pure helpers for global search: scoring how well some text matches, and cutting a
// short excerpt around the match. No imports, so they can be tested on their own.

const lower = (value) => String(value ?? "").toLowerCase();
const squash = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

// Does the text contain the search, ignoring case?
export function contains(text, needle) {
  const target = lower(needle);
  return target !== "" && lower(text).includes(target);
}

// How well does a TITLE match the search? 0 means it doesn't. Higher is better:
//   exact 100, starts with it 80, starts a word 60, appears inside a word 50.
export function titleScore(text, needle) {
  const haystack = lower(text);
  const target = lower(needle);
  if (!target || !haystack) return 0;

  if (haystack === target) return 100;
  if (haystack.startsWith(target)) return 80;

  const at = haystack.indexOf(target);
  if (at === -1) return 0;

  // Does it start a word? (the character before it isn't a letter or a digit)
  return /[\p{L}\p{N}]/u.test(haystack[at - 1]) ? 50 : 60;
}

// How well do a snippet's tags match? An exact tag 45, part of a tag 35.
export function tagScore(tags, needle) {
  const target = lower(needle);
  if (!target || !Array.isArray(tags)) return 0;

  const all = tags.map(lower);
  if (all.includes(target)) return 45;
  return all.some((tag) => tag.includes(target)) ? 35 : 0;
}

// Picks the field with the best score. scores: { title: 80, text: 10 } -> { field: "title", score: 80 }.
// If nothing scored, field is null.
export function bestMatch(scores) {
  let best = { field: null, score: 0 };
  for (const [field, score] of Object.entries(scores)) {
    if (score > best.score) best = { field, score };
  }
  return best;
}

// Sorts entries ({ score, time, item }) best first, newest first among equals, and keeps
// `limit` of them. hasMore says whether any were left out. The list you pass is left alone.
export function rank(entries, limit) {
  const sorted = [...entries].sort((a, b) => b.score - a.score || b.time - a.time);
  return {
    items: sorted.slice(0, limit).map((entry) => entry.item),
    hasMore: sorted.length > limit,
  };
}

// A short piece of plain text around the first match, on one line, cut at word boundaries,
// with … where it was shortened. With no match (or no search) it's just the beginning.
export function makeExcerpt(text, needle, radius = 70) {
  const flat = squash(text);
  if (!flat) return "";

  const target = squash(needle);
  const at = target ? lower(flat).indexOf(lower(target)) : -1;

  if (at === -1) {
    const end = Math.min(flat.length, radius * 2);
    return flat.slice(0, end) + (end < flat.length ? "…" : "");
  }

  let start = Math.max(0, at - radius);
  let end = Math.min(flat.length, at + target.length + radius);

  // Don't start or end in the middle of a word, when there's a space close by.
  if (start > 0 && flat[start - 1] !== " ") {
    const space = flat.indexOf(" ", start);
    if (space !== -1 && space < at) start = space + 1;
  }
  if (end < flat.length && flat[end] !== " ") {
    const space = flat.lastIndexOf(" ", end);
    if (space > at + target.length) end = space;
  }

  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}