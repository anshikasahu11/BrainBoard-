import Snippet from "../models/Snippet.js";
import AppError from "../utils/AppError.js";
import { isObjectId } from "../utils/objectId.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import { ROLES } from "../constants/roles.js";
import { LANGUAGES } from "../constants/snippets.js";
import { announce } from "../socket/realtime.js";
import { cleanCode, derive, toListItemDTO, toSnippetDTO } from "../services/snippetService.js";

const POPULATE = [
  { path: "createdBy", select: "name" },
  { path: "lastEditedBy", select: "name" },
];

const notFound = () => new AppError(404, "Snippet not found");
const asText = (value) => (typeof value === "string" ? value : "");

// Every lookup includes the workspace, so a snippet id from another workspace
// is treated exactly like one that doesn't exist.
function scoped(req, id) {
  if (!isObjectId(id)) throw notFound();
  return { _id: id, workspace: req.workspace._id };
}

// GET /api/workspaces/:workspaceId/snippets
// Filters: ?q=  ?language=  ?tag=  ?limit=
export async function listSnippets(req, res) {
  const filter = { workspace: req.workspace._id };

  const q = asText(req.query.q).trim().slice(0, 100);
  if (q) {
    const matcher = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ title: matcher }, { description: matcher }, { code: matcher }, { tags: matcher }];
  }

  const language = asText(req.query.language);
  if (language) {
    if (!LANGUAGES.includes(language)) throw new AppError(400, "Invalid language filter");
    filter.language = language;
  }

  const tag = asText(req.query.tag).trim().toLowerCase();
  if (tag) filter.tags = tag;

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

  // The full code is left out of list queries (see the model), so this stays light.
  const [snippets, total] = await Promise.all([
    Snippet.find(filter).sort({ updatedAt: -1 }).limit(limit).populate(POPULATE),
    Snippet.countDocuments(filter),
  ]);

  res.json({ snippets: snippets.map(toListItemDTO), total });
}

// GET /api/workspaces/:workspaceId/snippets/tags
// Every tag used in this workspace, most used first, for the filter menu.
export async function listTags(req, res) {
  const rows = await Snippet.aggregate([
    { $match: { workspace: req.workspace._id } },
    { $unwind: "$tags" },
    { $group: { _id: "$tags", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: 100 },
  ]);

  res.json({ tags: rows.map((row) => ({ name: row._id, count: row.count })) });
}

// POST /api/workspaces/:workspaceId/snippets
export async function createSnippet(req, res) {
  const { title, description = "", code, language = "javascript", tags = [] } = req.body;

  const clean = cleanCode(code);

  const snippet = await Snippet.create({
    workspace: req.workspace._id,
    title,
    description,
    code: clean,
    language,
    tags,
    ...derive(clean),
    createdBy: req.user._id,
    lastEditedBy: req.user._id,
  });
  await snippet.populate(POPULATE);

  // Teammates get the list-item shape: a preview, never the full code.
  announce(req, "snippet:created", { snippet: toListItemDTO(snippet) });

  // Phase 10: write an activity entry.
  res.status(201).json({ snippet: toSnippetDTO(snippet) });
}

// GET /api/workspaces/:workspaceId/snippets/:snippetId  (the full code)
export async function getSnippet(req, res) {
  const snippet = await Snippet.findOne(scoped(req, req.params.snippetId))
    .select("+code")
    .populate(POPULATE);
  if (!snippet) throw notFound();

  res.json({ snippet: toSnippetDTO(snippet) });
}

// PATCH /api/workspaces/:workspaceId/snippets/:snippetId
export async function updateSnippet(req, res) {
  const { baseRevision, title, description, code, language, tags } = req.body;
  const filter = scoped(req, req.params.snippetId);

  const changes = { lastEditedBy: req.user._id };
  if (title !== undefined) changes.title = title;
  if (description !== undefined) changes.description = description;
  if (language !== undefined) changes.language = language;
  if (tags !== undefined) changes.tags = tags;
  if (code !== undefined) {
    const clean = cleanCode(code);
    changes.code = clean;
    Object.assign(changes, derive(clean)); // refresh the preview and line count too
  }

  // One atomic step: apply the change ONLY IF the revision still matches.
  // Two saves can never both succeed from the same starting point.
  const updated = await Snippet.findOneAndUpdate(
    { ...filter, revision: baseRevision },
    { $set: changes, $inc: { revision: 1 } },
    { new: true, runValidators: true }
  )
    .select("+code")
    .populate(POPULATE);

  if (!updated) {
    const current = await Snippet.findOne(filter).select("revision");
    if (!current) throw notFound();

    throw new AppError(
      409,
      "This snippet was changed by someone else. Reload to see the latest version.",
      { currentRevision: current.revision }
    );
  }

  announce(req, "snippet:updated", { snippet: toListItemDTO(updated) });

  res.json({ snippet: toSnippetDTO(updated) });
}

// DELETE /api/workspaces/:workspaceId/snippets/:snippetId
// Owners and admins can delete any snippet. Members only their own.
export async function deleteSnippet(req, res) {
  const snippet = await Snippet.findOne(scoped(req, req.params.snippetId));
  if (!snippet) throw notFound();

  const privileged = req.membership.role === ROLES.OWNER || req.membership.role === ROLES.ADMIN;
  if (!privileged && !snippet.createdBy.equals(req.user._id)) {
    throw new AppError(403, "You can only delete snippets you created");
  }

  await snippet.deleteOne();

  announce(req, "snippet:deleted", { snippetId: snippet.id });

  res.status(204).end();
}