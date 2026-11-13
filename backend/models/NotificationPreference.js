import mongoose from "mongoose";

// A person's notification settings: which kinds they have switched OFF, and their time zone.
// Everything not listed as muted is on, so a kind added later is on for everyone by default.
// A person with no document here has everything on, in UTC.
const preferenceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    muted: { type: [String], default: undefined },
    // A name like "Asia/Kolkata". Reminders use it to know what "tomorrow" means for this person.
    timeZone: { type: String, default: undefined, maxlength: 64 },
  },
  { timestamps: true }
);

export default mongoose.model("NotificationPreference", preferenceSchema);