import AppError from "../utils/AppError.js";

// A document with one empty paragraph: what a new document starts as.
export const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

const MAX_DEPTH = 12;
const MAX_NODES = 20000;
const MAX_TEXT_NODE = 100000;
const MAX_PLAIN_TEXT = 200000;
const MAX_EXCERPT = 180;
const MAX_JSON_LENGTH = 800000;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

const SIMPLE_MARKS = new Set(["bold", "italic", "strike", "underline", "code"]);
const CONTAINERS = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "blockquote",
  "codeBlock",
]);
const LEAVES = new Set(["horizontalRule", "hardBreak"]);

const invalid = () => new AppError(400, "This document's content isn't valid");

// Only http, https and mailto links are allowed. A "javascript:" link would
// run code when clicked, so those are dropped (the text stays).
function safeHref(href) {
  if (typeof href !== "string" || href.length === 0 || href.length > 2048) return null;
  try {
    const url = new URL(href.trim());
    return ALLOWED_PROTOCOLS.has(url.protocol) ? href.trim() : null;
  } catch {
    return null;
  }
}

function cleanMarks(marks) {
  if (marks === undefined) return undefined;
  if (!Array.isArray(marks)) throw invalid();

  const out = [];
  for (const mark of marks) {
    if (!mark || typeof mark !== "object" || typeof mark.type !== "string") throw invalid();

    if (SIMPLE_MARKS.has(mark.type)) {
      out.push({ type: mark.type });
    } else if (mark.type === "link") {
      const href = safeHref(mark.attrs?.href);
      if (href) out.push({ type: "link", attrs: { href } });
    } else {
      throw invalid();
    }
  }
  return out.length > 0 ? out : undefined;
}

// Keeps only the attributes we know about, with checked values.
function cleanAttrs(type, attrs = {}) {
  if (attrs === null || typeof attrs !== "object" || Array.isArray(attrs)) throw invalid();

  switch (type) {
    case "heading": {
      const level = attrs.level ?? 1;
      if (!Number.isInteger(level) || level < 1 || level > 3) throw invalid();
      return { level };
    }
    case "orderedList": {
      const start = attrs.start ?? 1;
      if (!Number.isInteger(start) || start < 1 || start > 100000) throw invalid();
      return { start };
    }
    case "taskItem": {
      const checked = attrs.checked ?? false;
      if (typeof checked !== "boolean") throw invalid();
      return { checked };
    }
    case "codeBlock": {
      const language = attrs.language ?? null;
      if (language !== null && !(typeof language === "string" && /^[\w+#.-]{1,30}$/.test(language))) {
        throw invalid();
      }
      return { language };
    }
    default:
      return undefined;
  }
}

// Rebuilds one node from allowed pieces only, and collects its plain text.
function cleanNode(node, state, depth) {
  if (!node || typeof node !== "object" || Array.isArray(node)) throw invalid();
  if (depth > MAX_DEPTH || ++state.count > MAX_NODES) throw invalid();

  const { type } = node;

  if (type === "text") {
    if (typeof node.text !== "string" || node.text.length === 0 || node.text.length > MAX_TEXT_NODE) {
      throw invalid();
    }
    state.text.push(node.text);
    const marks = cleanMarks(node.marks);
    return marks ? { type, text: node.text, marks } : { type, text: node.text };
  }

  if (LEAVES.has(type)) {
    if (type === "hardBreak") state.text.push(" ");
    return { type };
  }

  if (CONTAINERS.has(type)) {
    const clean = { type };

    const attrs = cleanAttrs(type, node.attrs);
    if (attrs) clean.attrs = attrs;

    if (node.content !== undefined) {
      if (!Array.isArray(node.content)) throw invalid();
      clean.content = node.content.map((child) => cleanNode(child, state, depth + 1));
    }

    state.text.push(" "); // keep words from different blocks apart
    return clean;
  }

  throw invalid(); // an unknown node type, for example "script" or "iframe"
}

// Validates and rebuilds a whole document. Returns what to store.
export function cleanContent(content) {
  if (!content || typeof content !== "object" || Array.isArray(content) || content.type !== "doc") {
    throw invalid();
  }
  if (JSON.stringify(content).length > MAX_JSON_LENGTH) {
    throw new AppError(413, "That document is too large to save");
  }

  const state = { count: 0, text: [] };
  const children = content.content === undefined ? [{ type: "paragraph" }] : content.content;
  if (!Array.isArray(children)) throw invalid();

  const cleaned = {
    type: "doc",
    content: children.map((child) => cleanNode(child, state, 1)),
  };

  const plainText = state.text.join("").replace(/\s+/g, " ").trim().slice(0, MAX_PLAIN_TEXT);
  return { content: cleaned, plainText, excerpt: plainText.slice(0, MAX_EXCERPT) };
}

// ---------- The shapes the frontend receives ----------

function person(user) {
  return user?.id ? { id: user.id, name: user.name } : { id: null, name: "Former member" };
}

export function toListItemDTO(doc) {
  return {
    id: doc.id,
    title: doc.title,
    excerpt: doc.excerpt,
    revision: doc.revision,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdBy: person(doc.createdBy),
    lastEditedBy: person(doc.lastEditedBy),
  };
}

export function toDocumentDTO(doc) {
  return {
    ...toListItemDTO(doc),
    workspaceId: doc.workspace.toString(),
    content: doc.content,
  };
}