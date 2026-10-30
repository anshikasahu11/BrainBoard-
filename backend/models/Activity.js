import mongoose from "mongoose";
import { ACTIONS, CATEGORIES, RETENTION_DAYS, TARGET_KINDS } from "../constants/activity.js";

// One line of the workspace's history. Written by the server, never changed afterwards.
const activitySchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },

    // Who did it. The name is kept as it was at that moment.
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actorName: { type: String, required: true, maxlength: 50 },

    action: { type: String, enum: ACTIONS, required: true },
    category: { type: String, enum: CATEGORIES, required: true },

    // What it was about. The name is kept as it was, so "Rahul deleted Login API"
    // still reads that way after the task is gone.
    target: {
      kind: { type: String, enum: TARGET_KINDS, required: true },
      id: { type: mongoose.Schema.Types.ObjectId, required: true },
      name: { type: String, default: "", maxlength: 140 },
    },

    // A few small facts: { from, to } for a move, { number } for a version, { role }...
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  // createdAt is the time of the entry. Entries are never updated.
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false }
);

// The feed is read newest first, so ids (which grow over time) are the sort key and the page cursor.
activitySchema.index({ workspace: 1, _id: -1 });
activitySchema.index({ workspace: 1, category: 1, _id: -1 });
activitySchema.index({ workspace: 1, actor: 1, _id: -1 });
activitySchema.index({ workspace: 1, "target.id": 1, _id: -1 });

// The database removes old entries by itself.
activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

export default mongoose.model("Activity", activitySchema);