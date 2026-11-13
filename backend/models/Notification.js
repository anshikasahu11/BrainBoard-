import mongoose from "mongoose";
import { KIND_LIST, RETENTION_DAYS, TARGET_TYPES } from "../constants/notifications.js";

// One thing that needs one person's attention. Written by the server, and only ever changed
// by its recipient (marking it read, or dismissing it).
const notificationSchema = new mongoose.Schema(
  {
    // Who it's for.
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Where it happened. The name is kept as it was at that moment.
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    workspaceName: { type: String, required: true, maxlength: 50 },

    // Who caused it. The name is kept as it was at that moment.
    // A reminder isn't done by anyone, so for those the actor is null.
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorName: { type: String, default: "", maxlength: 50 },

    kind: { type: String, enum: KIND_LIST, required: true },

    target: {
      kind: { type: String, enum: TARGET_TYPES, required: true },
      id: { type: mongoose.Schema.Types.ObjectId, required: true },
      name: { type: String, default: "", maxlength: 140 },
    },

    // A few small facts: { priority, dueDate } for a task, { role } for a membership change.
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },

    // null until the person reads it.
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false }
);

// The list, newest first (ids grow over time, so they're the sort key and the page cursor).
notificationSchema.index({ user: 1, _id: -1 });
// The unread count.
notificationSchema.index({ user: 1, readAt: 1 });
// One workspace's notifications for one person.
notificationSchema.index({ user: 1, workspace: 1, _id: -1 });
// Deleting a workspace removes its notifications.
notificationSchema.index({ workspace: 1 });

// The database removes old ones by itself.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

export default mongoose.model("Notification", notificationSchema);