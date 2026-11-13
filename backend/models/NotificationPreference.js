import mongoose from "mongoose";

// Which kinds of notification a person has switched OFF. Everything not listed is on, so a
// kind added later is on for everyone by default. A person with no document here has
// everything on.
const preferenceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    muted: { type: [String], default: undefined },
  },
  { timestamps: true }
);

export default mongoose.model("NotificationPreference", preferenceSchema);