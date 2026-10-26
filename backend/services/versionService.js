import crypto from "node:crypto";
import Document from "../models/Document.js";
import DocumentVersion from "../models/DocumentVersion.js";
import AppError from "../utils/AppError.js";
import { emitToWorkspace } from "../socket/realtime.js";
import { AUTO_INTERVAL_MS, MAX_VERSIONS } from "../constants/versions.js";

// Load these before turning a version into the shape the frontend receives.
export const VERSION_POPULATE = [
  { path: "editedBy", select: "name" },
  { path: "createdBy", select: "name" },
];

const hashOf = (title, content) =>
  crypto.createHash("sha1").update(JSON.stringify({ title, content })).digest("hex");

const person = (user) => (user?.id ? { id: user.id, name: user.name } : null);

// For the list: no content, so a History list stays tiny.
export function toVersionListItem(version) {
  return {
    number: version.number,
    kind: version.kind,
    label: version.label,
    title: version.title,
    excerpt: version.excerpt,
    charCount: version.charCount,
    documentRevision: version.documentRevision,
    savedAt: version.savedAt, // when this text was saved
    createdAt: version.createdAt, // when the snapshot was taken
    editedBy: person(version.editedBy) ?? { id: null, name: "Former member" },
    createdBy: person(version.createdBy), // null for automatic versions
  };
}

// For opening one version: everything, including the full content.
export function toVersionDTO(version) {
  return { ...toVersionListItem(version), content: version.content };
}

// Gives out the next version number for a document. Atomic, so two snapshots at the
// same moment never get the same number. timestamps: false keeps this from changing
// the document's "edited" time.
async function nextNumber(documentId) {
  const doc = await Document.findByIdAndUpdate(
    documentId,
    { $inc: { versionCounter: 1 } },
    { new: true, timestamps: false }
  ).select("versionCounter");

  if (!doc) throw new AppError(404, "Document not found");
  return doc.versionCounter;
}

// When there are more than MAX_VERSIONS, remove the oldest AUTOMATIC ones.
// keepNumber (the version just created) is never removed.
async function pruneVersions(documentId, keepNumber) {
  const total = await DocumentVersion.countDocuments({ document: documentId });
  const excess = total - MAX_VERSIONS;
  if (excess <= 0) return;

  const oldest = await DocumentVersion.find({
    document: documentId,
    kind: "auto",
    number: { $lt: keepNumber },
  })
    .sort({ number: 1 })
    .limit(excess)
    .select("_id");

  if (oldest.length > 0) {
    await DocumentVersion.deleteMany({ _id: { $in: oldest.map((version) => version._id) } });
  }
}

// Is it time for another automatic version of this document?
export async function snapshotDue(documentId) {
  const latest = await DocumentVersion.findOne({ document: documentId })
    .sort({ number: -1 })
    .select("createdAt");

  return !latest || Date.now() - latest.createdAt.getTime() >= AUTO_INTERVAL_MS;
}

// Saves a document's current state (title + text) as a version.
// `doc` must be loaded with +plainText. Returns the version, or null if nothing was saved.
//   force: save even if it's blank or identical to the latest version (a person asked for it).
export async function createSnapshot(doc, { kind, label = "", createdBy = null, force = false }) {
  if (!force) {
    // A blank document isn't worth keeping.
    if (!doc.plainText || doc.plainText.trim() === "") return null;
  }

  const contentHash = hashOf(doc.title, doc.content);

  if (!force) {
    // The text is already kept if it's identical to the newest version.
    const latest = await DocumentVersion.findOne({ document: doc._id })
      .sort({ number: -1 })
      .select("contentHash");
    if (latest?.contentHash === contentHash) return null;
  }

  const number = await nextNumber(doc._id);

  const version = await DocumentVersion.create({
    document: doc._id,
    workspace: doc.workspace,
    number,
    kind,
    label,
    title: doc.title,
    content: doc.content,
    excerpt: doc.excerpt ?? "",
    charCount: doc.plainText?.length ?? 0,
    contentHash,
    editedBy: doc.lastEditedBy,
    savedAt: doc.updatedAt,
    createdBy,
    documentRevision: doc.revision,
  });

  await pruneVersions(doc._id, number);
  await version.populate(VERSION_POPULATE);
  return version;
}

// Tells everyone in the workspace (including the person who caused it) that a version exists.
export function announceVersionCreated(doc, version) {
  const workspaceId = String(doc.workspace);
  emitToWorkspace(workspaceId, "version:created", {
    workspaceId,
    documentId: String(doc._id),
    version: toVersionListItem(version),
  });
}

// Keeps the earlier state during a save. It must NEVER make the save itself fail: the
// document is already updated, and history is a safety net, not a gate.
export async function preserveQuietly(before) {
  try {
    const version = await createSnapshot(before, { kind: "auto" });
    if (version) announceVersionCreated(before, version);
  } catch (error) {
    console.error("Saving a version failed:", error.message);
  }
}