import mongoose from "mongoose";
import { PRIORITIES, STATUSES } from "../constants/tasks.js";

const taskSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 140 },
    // Plain text. React escapes it when displaying, so there's no HTML to inject.
    description: { type: String, default: "", maxlength: 5000 },
    status: { type: String, enum: STATUSES, default: "todo", required: true },
    priority: { type: String, enum: PRIORITIES, default: "medium", required: true },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // A plain date like "2026-12-31". A timestamp would shift by a day across time zones.
    dueDate: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
    // Order inside its column. Lower numbers come first. The server manages this.
    position: { type: Number, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// "The tasks in this column, in order" is the board's main query.
taskSchema.index({ workspace: 1, status: 1, position: 1 });
// "Assigned to me" and filtering by assignee.
taskSchema.index({ workspace: 1, assignee: 1, status: 1 });
// "Recently updated tasks".
taskSchema.index({ workspace: 1, updatedAt: -1 });

export default mongoose.model("Task", taskSchema);