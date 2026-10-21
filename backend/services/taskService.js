import Task from "../models/Task.js";
import Membership from "../models/Membership.js";
import AppError from "../utils/AppError.js";

const GAP = 1000; // room left between neighbours, so most drops change just one task
const MIN_GAP = 0.001; // below this the column is renumbered

// An assignee must belong to the workspace.
export async function assertWorkspaceMember(workspaceId, userId) {
  const isMember = await Membership.exists({ workspace: workspaceId, user: userId });
  if (!isMember) {
    const message = "That person isn't a member of this workspace";
    throw new AppError(400, message, { assignee: message });
  }
}

// The position for a task placed at the BOTTOM of a column.
export async function endPosition(workspaceId, status) {
  const last = await Task.findOne({ workspace: workspaceId, status })
    .sort({ position: -1 })
    .select("position");
  return last ? last.position + GAP : GAP;
}

// Renumber a column 1000, 2000, 3000... (keeps the current order).
async function rebalance(workspaceId, status) {
  const tasks = await Task.find({ workspace: workspaceId, status })
    .sort({ position: 1, createdAt: 1 })
    .select("_id");
  if (tasks.length === 0) return;

  await Task.bulkWrite(
    tasks.map((task, index) => ({
      updateOne: { filter: { _id: task._id }, update: { $set: { position: (index + 1) * GAP } } },
    }))
  );
}

// The position that puts a task right AFTER `afterId` in a column
// (or at the top when afterId is null). `movingId` is left out of the
// neighbour search, so a task never counts itself as its own neighbour.
export async function positionAfter(workspaceId, status, afterId, movingId) {
  const column = { workspace: workspaceId, status, _id: { $ne: movingId } };

  if (!afterId) {
    const first = await Task.findOne(column).sort({ position: 1 }).select("position");
    return first ? first.position - GAP : GAP;
  }

  const after = await Task.findOne({ ...column, _id: afterId }).select("position");
  if (!after) {
    throw new AppError(400, "That task isn't in the column you're moving to");
  }

  const next = await Task.findOne({ ...column, position: { $gt: after.position } })
    .sort({ position: 1 })
    .select("position");
  if (!next) return after.position + GAP;

  // Dropped between two cards: take the midpoint. If they've become too
  // close, renumber the column first (the gaps are 1000 again afterwards).
  if (next.position - after.position < MIN_GAP) {
    await rebalance(workspaceId, status);
    return positionAfter(workspaceId, status, afterId, movingId);
  }
  return (after.position + next.position) / 2;
}

// ---------- The shape the frontend receives ----------
// Always call task.populate(...) before this, so the people are loaded.

function person(user) {
  return user && user.name ? { id: user.id, name: user.name } : null;
}

export function toTaskDTO(task) {
  return {
    id: task.id,
    workspaceId: task.workspace.toString(),
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    position: task.position,
    assignee: person(task.assignee), // null when unassigned
    createdBy: person(task.createdBy) ?? { id: null, name: "Former member" },
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}