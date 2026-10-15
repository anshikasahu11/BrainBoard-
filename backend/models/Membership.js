import mongoose from "mongoose";
import { ROLES, ROLE_LIST } from "../constants/roles.js";

// One document per (user, workspace) pair: "Rahul is an admin of Acme Dev".
const membershipSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    role: { type: String, enum: ROLE_LIST, default: ROLES.MEMBER, required: true },
  },
  { timestamps: true }
);

// A user can belong to a workspace only once. MongoDB enforces this itself.
membershipSchema.index({ user: 1, workspace: 1 }, { unique: true });
// Fast "who is in this workspace?" lookups.
membershipSchema.index({ workspace: 1 });

export default mongoose.model("Membership", membershipSchema);