import mongoose from "mongoose";

// A record that one reminder has been sent to one person. It lives APART from the notification,
// on purpose: people dismiss and delete notifications, and that must never make the same
// reminder come back. The database allows one record per person and key, so a reminder can't
// be sent twice, even across restarts or two servers running at once.
const sentReminderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // "kind:taskId:dueDate". The due date is part of it, so moving a due date earns new reminders.
    key: { type: String, required: true, maxlength: 120 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

sentReminderSchema.index({ user: 1, key: 1 }, { unique: true });

// A reminder only applies within a few days of its due date, so after 30 days the record can go.
sentReminderSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.model("SentReminder", sentReminderSchema);