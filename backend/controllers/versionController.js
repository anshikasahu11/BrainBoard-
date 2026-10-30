import Document from "../models/Document.js";
import DocumentVersion from "../models/DocumentVersion.js";
import AppError from "../utils/AppError.js";
import { cleanContent, toDocumentDTO, toListItemDTO } from "../services/documentService.js";
import { recordActivity } from "../services/activityService.js";
import { announce, emitToWorkspace } from "../socket/realtime.js";
import {
  VERSION_POPULATE,
  announceVersionCreated,
  createSnapshot,
  toVersionDTO,
  toVersionListItem,
} from "../services/versionService.js";

const DOC_POPULATE = [
  { path: "createdBy", select: "name" },
  { path: "lastEditedBy", select: "name" },
];

const notFound = () => new AppError(404, "Version not found");

// "3" -> 3. Anything that isn't a positive whole number is simply "not found".
function parseNumber(value) {
  if (!/^\d{1,9}$/.test(value)) throw notFound();
  const number = Number(value);
  if (number < 1) throw notFound();
  return number;
}

// Every version lookup includes the document AND the workspace.
const versionFilter = (req, extra = {}) => ({
  document: req.document._id,
  workspace: req.workspace._id,
  ...extra,
});

// The document changed since you looked (409), or it's gone (404).
async function staleOrGone(req) {
  const current = await Document.findOne({
    _id: req.document._id,
    workspace: req.workspace._id,
  }).select("revision");

  if (!current) return new AppError(404, "Document not found");

  return new AppError(
    409,
    "This document was changed by someone else. Reload to see the latest version.",
    { currentRevision: current.revision }
  );
}

// GET .../versions  (newest first, no content)
export async function listVersions(req, res) {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const filter = versionFilter(req);

  const [versions, total] = await Promise.all([
    DocumentVersion.find(filter).sort({ number: -1 }).limit(limit).populate(VERSION_POPULATE),
    DocumentVersion.countDocuments(filter),
  ]);

  res.json({ versions: versions.map(toVersionListItem), total });
}

// POST .../versions  { label? }  (save the current text as a named version)
export async function createVersion(req, res) {
  const doc = await Document.findOne({
    _id: req.document._id,
    workspace: req.workspace._id,
  }).select("+plainText");
  if (!doc) throw new AppError(404, "Document not found");

  if (!doc.plainText || doc.plainText.trim() === "") {
    throw new AppError(400, "There's nothing to save yet. Write something first.");
  }

  // force: a person asked for this one, so it's saved even if the text is unchanged.
  const version = await createSnapshot(doc, {
    kind: "manual",
    label: req.body.label ?? "",
    createdBy: req.user._id,
    force: true,
  });

  announceVersionCreated(doc, version);
  // Automatic versions aren't news. A version someone chose to save is.
  await recordActivity(req, {
    action: "version.saved",
    target: { type: "document", id: doc._id, name: doc.title },
    meta: { number: version.number, label: version.label },
  });

  res.status(201).json({ version: toVersionListItem(version) });
}

// GET .../versions/:number  (the full content)
export async function getVersion(req, res) {
  const number = parseNumber(req.params.number);

  const version = await DocumentVersion.findOne(versionFilter(req, { number }))
    .select("+content")
    .populate(VERSION_POPULATE);
  if (!version) throw notFound();

  res.json({ version: toVersionDTO(version) });
}

// POST .../versions/:number/restore  { baseRevision }
export async function restoreVersion(req, res) {
  const number = parseNumber(req.params.number);
  const { baseRevision } = req.body;
  const docFilter = { _id: req.document._id, workspace: req.workspace._id };

  const version = await DocumentVersion.findOne(versionFilter(req, { number })).select("+content");
  if (!version) throw notFound();

  // The same rule as every other save: only if nobody changed the document since you looked.
  const current = await Document.findOne({ ...docFilter, revision: baseRevision }).select("+plainText");
  if (!current) throw await staleOrGone(req);

  // Check the old text again with today's rules before it becomes the live document.
  let cleaned;
  try {
    cleaned = cleanContent(version.content);
  } catch {
    throw new AppError(400, "This version can't be restored");
  }

  // 1. Keep what's there now, so restoring never loses anything.
  //    (Skipped if it's blank, or already saved as the newest version.)
  const backup = await createSnapshot(current, {
    kind: "restore-backup",
    label: `Before restoring version ${number}`,
    createdBy: req.user._id,
  });
  if (backup) announceVersionCreated(current, backup);

  // 2. Put the old version in place, but only if nobody saved in the meantime.
  const updated = await Document.findOneAndUpdate(
    { ...docFilter, revision: baseRevision },
    {
      $set: {
        title: version.title,
        content: cleaned.content,
        plainText: cleaned.plainText,
        excerpt: cleaned.excerpt,
        lastEditedBy: req.user._id,
      },
      $inc: { revision: 1 },
    },
    { new: true, runValidators: true }
  ).populate(DOC_POPULATE);

  if (!updated) throw await staleOrGone(req);

  // Anyone with this document open hears that a newer version exists.
  announce(req, "document:updated", { document: toListItemDTO(updated) });
  await recordActivity(req, {
    action: "version.restored",
    target: { type: "document", id: updated._id, name: updated.title },
    meta: { number },
  });

  res.json({ document: toDocumentDTO(updated), restoredFrom: number });
}

// DELETE .../versions/:number  (owner or admin: for example, to remove an accidental secret)
export async function deleteVersion(req, res) {
  const number = parseNumber(req.params.number);

  const version = await DocumentVersion.findOne(versionFilter(req, { number }));
  if (!version) throw notFound();

  await version.deleteOne();

  emitToWorkspace(req.workspace.id, "version:deleted", {
    workspaceId: req.workspace.id,
    documentId: req.document.id,
    number,
  });
  await recordActivity(req, {
    action: "version.deleted",
    target: { type: "document", id: req.document._id, name: req.document.title },
    meta: { number },
  });

  res.status(204).end();
}