import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    title: { type: String, trim: true, minlength: 1, maxlength: 120, default: "Untitled" },

    // The editor's JSON. Never HTML. It's validated and rebuilt on every save.
    content: { type: mongoose.Schema.Types.Mixed, required: true },

    // Derived on every save, for search and list previews.
    // select: false keeps the full text out of normal queries.
    plainText: { type: String, default: "", select: false },
    excerpt: { type: String, default: "" },

    // Goes up by one on every save. Used to detect edit conflicts.
    revision: { type: Number, default: 0, min: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, minimize: false }
);

// "Recently edited documents in this workspace" is the main query.
documentSchema.index({ workspace: 1, updatedAt: -1 });

export default mongoose.model("Document", documentSchema);