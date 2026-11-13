import mongoose from "mongoose";

// One AI request, for counting. It holds numbers and names only. It NEVER holds the text
// that was sent or the answer that came back.
const aiUsageSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // "2026-11-13" (UTC): which day's budget this counted against.
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },

    feature: { type: String, required: true, maxlength: 40 },
    provider: { type: String, required: true, maxlength: 20 },
    model: { type: String, required: true, maxlength: 80 },

    inputTokens: { type: Number, default: 0, min: 0 },
    outputTokens: { type: Number, default: 0, min: 0 },

    // ok: the provider answered. error: the request reached it and failed.
    status: { type: String, enum: ["ok", "error"], required: true },
    ms: { type: Number, default: 0, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// "How much has this person used today?" and "how much has this workspace used today?"
aiUsageSchema.index({ day: 1, user: 1 });
aiUsageSchema.index({ day: 1, workspace: 1 });

// The database removes old rows by itself after 90 days.
aiUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model("AiUsage", aiUsageSchema);