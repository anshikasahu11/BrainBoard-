import Document from "../models/Document.js";
import DocumentVersion from "../models/DocumentVersion.js";
import AppError from "../utils/AppError.js";
import { isObjectId } from "../utils/objectId.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import { ROLES } from "../constants/roles.js";
import { announce } from "../socket/realtime.js";
import {
  EMPTY_DOC,
  cleanContent,
  toDocumentDTO,
  toListItemDTO,
} from "../services/documentService.js";
import { preserveQuietly, snapshotDue } from "../services/versionService.js";

const POPULATE = [
  { path: "createdBy", select: "name" },
  { path: "lastEditedBy", select: "name" },
];

const notFound = () => new AppError(404, "Document not found");

// Every lookup includes the workspace, so a document id from another
// workspace is treated exactly like one that doesn't exist.
function scoped(req, id) {
  if (!isObjectId(id)) throw notFound();
  return { _id: id, workspace: req.workspace._id };
}

// GET /api/workspaces/:workspaceId/documents?q=...
export async function listDocuments(req, res) {
  const filter = { workspace: req.workspace._id };

  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  if (q) {
    const matcher = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ title: matcher }, { plainText: matcher }];
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

  const docs = await Document.find(filter)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .populate(POPULATE);

  res.json({ documents: docs.map(toListItemDTO) });
}

// POST /api/workspaces/:workspaceId/documents
export async function createDocument(req, res) {
  const doc = await Document.create({
    workspace: req.workspace._id,
    title: req.body.title ?? "Untitled",
    content: EMPTY_DOC,
    createdBy: req.user._id,
    lastEditedBy: req.user._id,
  });
  await doc.populate(POPULATE);

  // Teammates get the list-item shape: no content, so the event stays tiny.
  announce(req, "document:created", { document: toListItemDTO(doc) });

  // Phase 10: write an activity entry.
  res.status(201).json({ document: toDocumentDTO(doc) });
}

// GET /api/workspaces/:workspaceId/documents/:documentId
export async function getDocument(req, res) {
  const doc = await Document.findOne(scoped(req, req.params.documentId)).populate(POPULATE);
  if (!doc) throw notFound();

  res.json({ document: toDocumentDTO(doc) });
}

// PATCH /api/workspaces/:workspaceId/documents/:documentId
export async function updateDocument(req, res) {
  const { title, content, baseRevision } = req.body;
  const filter = scoped(req, req.params.documentId);

  const changes = { lastEditedBy: req.user._id };
  if (title !== undefined) changes.title = title;
  if (content !== undefined) {
    const cleaned = cleanContent(content); // throws 400 if the content isn't valid
    changes.content = cleaned.content;
    changes.plainText = cleaned.plainText;
    changes.excerpt = cleaned.excerpt;
  }

  // Version history: now and then (see AUTO_INTERVAL_MS), keep the document as it is
  // right now, BEFORE this save replaces it. We only read it when a version is due, so
  // a normal autosave costs one cheap lookup.
  let before = null;
  if (await snapshotDue(filter._id)) {
    before = await Document.findOne({ ...filter, revision: baseRevision }).select("+plainText");
  }

  // One atomic step: apply the change ONLY IF the revision still matches.
  // Two saves can never both succeed from the same starting point.
  const updated = await Document.findOneAndUpdate(
    { ...filter, revision: baseRevision },
    { $set: changes, $inc: { revision: 1 } },
    { new: true, runValidators: true }
  ).populate(POPULATE);

  if (!updated) {
    const current = await Document.findOne(filter).select("revision");
    if (!current) throw notFound();

    throw new AppError(
      409,
      "This document was changed by someone else. Reload to see the latest version.",
      { currentRevision: current.revision }
    );
  }

  // The save went through, so now keep the earlier state. This never fails the request.
  if (before) await preserveQuietly(before);

  // The new revision tells anyone who has this document open that theirs is out of date.
  announce(req, "document:updated", { document: toListItemDTO(updated) });

  res.json({ document: toDocumentDTO(updated) });
}

// DELETE /api/workspaces/:workspaceId/documents/:documentId
// Owners and admins can delete any document. Members only their own.
export async function deleteDocument(req, res) {
  const doc = await Document.findOne(scoped(req, req.params.documentId));
  if (!doc) throw notFound();

  const privileged = req.membership.role === ROLES.OWNER || req.membership.role === ROLES.ADMIN;
  if (!privileged && !doc.createdBy.equals(req.user._id)) {
    throw new AppError(403, "You can only delete documents you created");
  }

  await doc.deleteOne();
  // Its history goes with it.
  await DocumentVersion.deleteMany({ document: doc._id });

  announce(req, "document:deleted", { documentId: doc.id });

  res.status(204).end();
}