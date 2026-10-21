import mongoose from "mongoose";
import { LANGUAGES, MAX_CODE_LENGTH } from "../constants/snippets.js";

const snippetSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    description: { type: String, default: "", maxlength: 1000 },

    // Plain text, never HTML. select: false keeps it out of list queries; ask for
    // it with .select("+code") when you need the whole thing.
    code: { type: String, required: true, maxlength: MAX_CODE_LENGTH, select: false },
    language: { type: String, enum: LANGUAGES, default: "javascript", required: true },
    tags: { type: [String], default: [] },

    // Worked out on every save, so the list can show a preview without the full code.
    preview: { type: String, default: "" },
    lineCount: { type: Number, default: 1 },
    truncated: { type: Boolean, default: false },

    // Goes up by one on every save. Used to detect edit conflicts.
    revision: { type: Number, default: 0, min: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// "Recently edited snippets in this workspace" is the main query.
snippetSchema.index({ workspace: 1, updatedAt: -1 });
// Filtering by language, and by tag.
snippetSchema.index({ workspace: 1, language: 1, updatedAt: -1 });
snippetSchema.index({ workspace: 1, tags: 1 });

export default mongoose.model("Snippet", snippetSchema);