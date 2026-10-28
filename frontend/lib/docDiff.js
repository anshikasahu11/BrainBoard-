// Comparing two versions of a document.
// 1. A document (the editor's JSON) becomes a list of readable lines.
// 2. Two lists are compared line by line.
// 3. Related changed lines are compared word by word.
// Everything here is plain JavaScript with no imports, so it can be tested on its own.

const MAX_CELLS = 4_000_000; // the most work we'll do for one comparison (about 2000 x 2000 lines)

// ---------- 1. A document becomes a list of lines ----------

function inlineText(node) {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return " ";
  return (node.content ?? []).map(inlineText).join("");
}

// Bullets, numbers and checkboxes make the structure visible in the comparison.
function listLines(list) {
  const lines = [];
  let number = Number.isInteger(list.attrs?.start) ? list.attrs.start : 1;

  for (const item of list.content ?? []) {
    let marker;
    if (list.type === "taskList") marker = item.attrs?.checked ? "[x] " : "[ ] ";
    else if (list.type === "orderedList") marker = `${number++}. `;
    else marker = "• ";

    const inner = (item.content ?? []).flatMap(blockLines);
    if (inner.length === 0) {
      lines.push(marker.trimEnd());
      continue;
    }

    // The first line carries the marker, the rest (including nested lists) are indented under it.
    inner.forEach((line, index) => {
      lines.push((index === 0 ? marker : " ".repeat(marker.length)) + line);
    });
  }
  return lines;
}

function blockLines(node) {
  switch (node.type) {
    case "paragraph": {
      const text = inlineText(node).trim();
      return text ? [text] : [];
    }
    case "heading": {
      const text = inlineText(node).trim();
      return text ? [`${"#".repeat(node.attrs?.level ?? 1)} ${text}`] : [];
    }
    case "codeBlock": {
      const code = inlineText(node).replace(/\n$/, "");
      return [`\`\`\`${node.attrs?.language ?? ""}`, ...code.split("\n"), "```"];
    }
    case "horizontalRule":
      return ["---"];
    case "blockquote":
      return (node.content ?? []).flatMap(blockLines).map((line) => `> ${line}`);
    case "bulletList":
    case "orderedList":
    case "taskList":
      return listLines(node);
    default: {
      const text = inlineText(node).trim();
      return text ? [text] : [];
    }
  }
}

export function documentToLines(doc) {
  if (!doc || !Array.isArray(doc.content)) return [];
  return doc.content.flatMap(blockLines);
}

// ---------- 2. Comparing two lists ----------

// Compares two lists. Returns [{ type: "equal" | "remove" | "add", value }], or null if the
// two are too big and too different to compare quickly.
export function diffSequence(a, b) {
  // Most edits touch the middle of a document, so skip what's identical at both ends first.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;

  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }

  const head = a.slice(0, start).map((value) => ({ type: "equal", value }));
  const tail = a.slice(endA).map((value) => ({ type: "equal", value }));
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);

  const n = midA.length;
  const m = midB.length;
  if (n * m > MAX_CELLS) return null;

  // table[i][j] = how many items the two lists have in common from i and j onwards.
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        midA[i] === midB[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }

  const middle = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (midA[i] === midB[j]) {
      middle.push({ type: "equal", value: midA[i] });
      i += 1;
      j += 1;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      middle.push({ type: "remove", value: midA[i] });
      i += 1;
    } else {
      middle.push({ type: "add", value: midB[j] });
      j += 1;
    }
  }
  while (i < n) middle.push({ type: "remove", value: midA[i++] });
  while (j < m) middle.push({ type: "add", value: midB[j++] });

  return [...head, ...middle, ...tail];
}

// ---------- 3. Word by word, inside a changed line ----------

// Words, runs of spaces, and single punctuation marks.
const TOKEN = /\s+|[\p{L}\p{N}_'’-]+|[^\s\p{L}\p{N}_'’-]/gu;
const tokenize = (line) => line.match(TOKEN) ?? [];

function mergeParts(ops) {
  const parts = [];
  for (const op of ops) {
    const last = parts[parts.length - 1];
    if (last && last.type === op.type) last.text += op.value;
    else parts.push({ type: op.type, text: op.value });
  }
  return parts;
}

// Marks the exact words that changed between two related lines. Returns null when the
// lines are too different to be worth marking word by word (a plain removed line and a
// plain added line read better then).
function inlineDiff(removedLine, addedLine) {
  const a = tokenize(removedLine);
  const b = tokenize(addedLine);

  const ops = diffSequence(a, b);
  if (!ops) return null;

  const words = (tokens) => tokens.filter((token) => token.trim() !== "").length;
  const kept = ops.filter((op) => op.type === "equal" && op.value.trim() !== "").length;
  const most = Math.max(words(a), words(b));
  if (most === 0 || kept / most < 0.3) return null;

  const parts = mergeParts(ops);
  return {
    from: parts.filter((part) => part.type !== "add"), // the old line: unchanged and removed words
    to: parts.filter((part) => part.type !== "remove"), // the new line: unchanged and added words
  };
}

// ---------- The whole comparison ----------

// base and target are { title, content }. The result describes how to get from base to target:
//   "add" lines are in the target but not the base, "remove" lines are in the base but not the target.
//   entries: [{ type: "equal" | "add" | "remove", text, parts }]  (parts marks changed words, or is null)
//   stats:   { added, removed }   (line counts)
//   tooLarge: the two are too big and too different to compare
export function compareDocuments(base, target) {
  const titleChanged = base.title !== target.title ? { from: base.title, to: target.title } : null;

  const baseLines = documentToLines(base.content);
  const targetLines = documentToLines(target.content);

  const ops = diffSequence(baseLines, targetLines);
  if (!ops) {
    return { tooLarge: true, titleChanged, entries: [], stats: { added: 0, removed: 0 }, identical: false };
  }

  const entries = [];
  let index = 0;
  while (index < ops.length) {
    if (ops[index].type === "equal") {
      entries.push({ type: "equal", text: ops[index].value, parts: null });
      index += 1;
      continue;
    }

    // A run of changes between two unchanged lines: removed lines first, then added lines.
    const removed = [];
    const added = [];
    while (index < ops.length && ops[index].type !== "equal") {
      (ops[index].type === "remove" ? removed : added).push(ops[index].value);
      index += 1;
    }

    const removedEntries = removed.map((text) => ({ type: "remove", text, parts: null }));
    const addedEntries = added.map((text) => ({ type: "add", text, parts: null }));

    // The first removed line and the first added line are probably the same line, edited, and so on.
    for (let k = 0; k < Math.min(removed.length, added.length); k += 1) {
      const inline = inlineDiff(removed[k], added[k]);
      if (inline) {
        removedEntries[k].parts = inline.from;
        addedEntries[k].parts = inline.to;
      }
    }

    entries.push(...removedEntries, ...addedEntries);
  }

  const stats = {
    added: entries.filter((entry) => entry.type === "add").length,
    removed: entries.filter((entry) => entry.type === "remove").length,
  };

  return {
    tooLarge: false,
    titleChanged,
    entries,
    stats,
    identical: !titleChanged && stats.added === 0 && stats.removed === 0,
  };
}

// Hides long stretches of unchanged lines, keeping a few lines of context around each change.
// Hidden stretches become { type: "gap", count }.
export function collapseEntries(entries, context = 2) {
  const keep = new Array(entries.length).fill(false);

  entries.forEach((entry, index) => {
    if (entry.type === "equal") return;
    const from = Math.max(0, index - context);
    const to = Math.min(entries.length - 1, index + context);
    for (let k = from; k <= to; k += 1) keep[k] = true;
  });

  const result = [];
  let hidden = 0;
  entries.forEach((entry, index) => {
    if (keep[index]) {
      if (hidden > 0) {
        result.push({ type: "gap", count: hidden });
        hidden = 0;
      }
      result.push(entry);
    } else {
      hidden += 1;
    }
  });
  if (hidden > 0) result.push({ type: "gap", count: hidden });

  return result;
}