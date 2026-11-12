import Document from "../models/Document.js";
import Membership from "../models/Membership.js";
import Snippet from "../models/Snippet.js";
import Task from "../models/Task.js";
import AppError from "../utils/AppError.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import {
  bestMatch,
  contains,
  makeExcerpt,
  rank,
  tagScore,
  titleScore,
} from "../utils/searchText.js";

const TYPES = ["documents", "tasks", "snippets", "members"];
const MIN_LENGTH = 2;
const MAX_LENGTH = 100;

const asText = (value) => (typeof value === "string" ? value : "");

function parseTypes(value) {
  if (!value) return TYPES;

  const list = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (list.length === 0 || list.some((type) => !TYPES.includes(type))) {
    throw new AppError(400, "Invalid types filter");
  }
  return [...new Set(list)];
}

// Gathers candidates in TWO lookups: things whose title matches, and things that match
// somewhere else. Without this, a pile of newer documents that merely mention a word
// could push out an older one that is NAMED that word.
async function collect(find, titleFilter, otherFilter, candidates) {
  const [byTitle, byOther] = await Promise.all([
    find(titleFilter, candidates),
    find(otherFilter, candidates),
  ]);

  const seen = new Set();
  const merged = [];
  for (const item of [...byTitle, ...byOther]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

// ----- One search per kind of thing. Each returns { items, hasMore }. -----
// Every query starts from { workspace }, so another workspace's data can never appear.

async function searchDocuments({ workspace, rx, q, limit, candidates }) {
  const find = (filter, count) =>
    Document.find({ workspace, ...filter })
      .select("title updatedAt +plainText")
      .sort({ updatedAt: -1 })
      .limit(count);

  const found = await collect(find, { title: rx }, { plainText: rx }, candidates);

  return rank(
    found.map((doc) => {
      const best = bestMatch({
        title: titleScore(doc.title, q),
        text: contains(doc.plainText, q) ? 10 : 0,
      });

      return {
        score: Math.max(best.score, 1),
        time: doc.updatedAt.getTime(),
        item: {
          id: doc.id,
          title: doc.title,
          matchedIn: best.field ?? "text",
          excerpt: makeExcerpt(doc.plainText, q),
          updatedAt: doc.updatedAt,
        },
      };
    }),
    limit
  );
}

async function searchTasks({ workspace, rx, q, limit, candidates }) {
  const find = (filter, count) =>
    Task.find({ workspace, ...filter })
      .select("title description status priority updatedAt")
      .sort({ updatedAt: -1 })
      .limit(count);

  const found = await collect(find, { title: rx }, { description: rx }, candidates);

  return rank(
    found.map((task) => {
      const best = bestMatch({
        title: titleScore(task.title, q),
        description: contains(task.description, q) ? 30 : 0,
      });

      return {
        score: Math.max(best.score, 1),
        time: task.updatedAt.getTime(),
        item: {
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          matchedIn: best.field ?? "description",
          excerpt: makeExcerpt(task.description, q),
          updatedAt: task.updatedAt,
        },
      };
    }),
    limit
  );
}

async function searchSnippets({ workspace, rx, q, limit, candidates }) {
  const find = (filter, count) =>
    Snippet.find({ workspace, ...filter })
      .select("title description language tags updatedAt +code")
      .sort({ updatedAt: -1 })
      .limit(count);

  const found = await collect(
    find,
    { title: rx },
    { $or: [{ description: rx }, { code: rx }, { tags: rx }] },
    candidates
  );

  return rank(
    found.map((snippet) => {
      const best = bestMatch({
        title: titleScore(snippet.title, q),
        tags: tagScore(snippet.tags, q),
        description: contains(snippet.description, q) ? 30 : 0,
        code: contains(snippet.code, q) ? 20 : 0,
      });

      // Show the part that actually matched, or else the beginning of the description (or the code).
      const source = contains(snippet.description, q)
        ? snippet.description
        : contains(snippet.code, q)
          ? snippet.code
          : snippet.description || snippet.code;

      return {
        score: Math.max(best.score, 1),
        time: snippet.updatedAt.getTime(),
        item: {
          id: snippet.id,
          title: snippet.title,
          language: snippet.language,
          tags: snippet.tags,
          matchedIn: best.field ?? "code",
          excerpt: makeExcerpt(source, q),
          updatedAt: snippet.updatedAt,
        },
      };
    }),
    limit
  );
}

async function searchMembers({ workspace, rx, q, limit }) {
  const memberships = await Membership.find({ workspace }).populate({
    path: "user",
    select: "name email",
    match: { $or: [{ name: rx }, { email: rx }] },
  });

  return rank(
    memberships
      .filter((membership) => membership.user) // the populate leaves out people who don't match
      .map((membership) => {
        const best = bestMatch({
          name: titleScore(membership.user.name, q),
          email: contains(membership.user.email, q) ? 30 : 0,
        });

        return {
          score: Math.max(best.score, 1),
          time: membership.createdAt ? membership.createdAt.getTime() : 0,
          item: {
            id: membership.user.id,
            title: membership.user.name,
            email: membership.user.email,
            role: membership.role,
            matchedIn: best.field ?? "name",
          },
        };
      }),
    limit
  );
}

const SEARCHES = {
  documents: searchDocuments,
  tasks: searchTasks,
  snippets: searchSnippets,
  members: searchMembers,
};

// GET /api/workspaces/:workspaceId/search?q=...&types=documents,tasks&limit=5
// Read-only. Returns short excerpts, never whole documents or code.
export async function searchWorkspace(req, res) {
  const q = asText(req.query.q).replace(/\s+/g, " ").trim().slice(0, MAX_LENGTH).trim();
  if (q.length < MIN_LENGTH) {
    throw new AppError(400, `Type at least ${MIN_LENGTH} characters to search`);
  }

  const types = parseTypes(asText(req.query.types));
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 20);

  const context = {
    workspace: req.workspace._id,
    // What you type is searched for literally: (, ., * and friends mean nothing special.
    rx: new RegExp(escapeRegex(q), "i"),
    q,
    limit,
    // Look at a few more than we show, so ranking has something to choose from.
    candidates: limit * 4,
  };

  const entries = await Promise.all(types.map(async (type) => [type, await SEARCHES[type](context)]));

  // Every group is always present, empty when it wasn't searched.
  const results = Object.fromEntries(TYPES.map((type) => [type, { items: [], hasMore: false }]));
  for (const [type, value] of entries) results[type] = value;

  res.json({ query: q, results });
}