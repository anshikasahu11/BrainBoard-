import mongoose from "mongoose";
import { KINDS, MAX_LABEL_LENGTH } from "../constants/versions.js";

// One saved state of a document: its title and text at some moment.
const versionSchema = new mongoose.Schema(
  {
    document: { type: mongoose.Schema.Types.ObjectId, ref: "Document", required: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },

    // 1, 2, 3... per document. Numbers are never reused, even after a delete.
    number: { type: Number, required: true, min: 1 },

    kind: { type: String, enum: KINDS, required: true },
    label: { type: String, default: "", maxlength: MAX_LABEL_LENGTH },

    title: { type: String, required: true },
    // The editor's JSON, already checked when it was saved. select: false keeps it
    // out of lists; ask for it with .select("+content") when you need it.
    content: { type: mongoose.Schema.Types.Mixed, required: true, select: false },
    excerpt: { type: String, default: "" },
    charCount: { type: Number, default: 0 },

    // A fingerprint of title + text, so an unchanged state isn't saved twice in a row.
    contentHash: { type: String, required: true },

    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // who wrote this text
    savedAt: { type: Date, required: true }, // when this text was saved
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // who made the version (null = automatic)
    documentRevision: { type: Number, default: 0 },
  },
  // createdAt = when the snapshot was taken. (savedAt is when the TEXT was saved.)
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false }
);

versionSchema.index({ document: 1, number: -1 }, { unique: true });
versionSchema.index({ workspace: 1 });

export default mongoose.model("DocumentVersion", versionSchema);