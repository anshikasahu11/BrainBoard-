import Task from "../models/Task.js";
import AppError from "../utils/AppError.js";
import { isObjectId } from "../utils/objectId.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import { ROLES } from "../constants/roles.js";
import { PRIORITIES, STATUSES } from "../constants/tasks.js";
import {
  assertWorkspaceMember,
  endPosition,
  positionAfter,
  toTaskDTO,
} from "../services/taskService.js";

const POPULATE = [
  { path: "assignee", select: "name" },
  { path: "createdBy", select: "name" },
];

const notFound = () => new AppError(404, "Task not found");
const asText = (value) => (typeof value === "string" ? value : "");

// Every lookup includes the workspace, so a task id from another workspace
// is treated exactly like one that doesn't exist.
function scoped(req, id) {
  if (!isObjectId(id)) throw notFound();
  return { _id: id, workspace: req.workspace._id };
}

// GET /api/workspaces/:workspaceId/tasks
// Filters: ?q=  ?status=  ?priority=  ?assignee=me|unassigned|<userId>  ?sort=updated
export async function listTasks(req, res) {
  const filter = { workspace: req.workspace._id };

  const q = asText(req.query.q).trim().slice(0, 100);
  if (q) {
    const matcher = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ title: matcher }, { description: matcher }];
  }

  const status = asText(req.query.status);
  if (status) {
    if (!STATUSES.includes(status)) throw new AppError(400, "Invalid status filter");
    filter.status = status;
  }

  const priority = asText(req.query.priority);
  if (priority) {
    if (!PRIORITIES.includes(priority)) throw new AppError(400, "Invalid priority filter");
    filter.priority = priority;
  }

  const assignee = asText(req.query.assignee);
  if (assignee === "me") {
    filter.assignee = req.user._id;
  } else if (assignee === "unassigned") {
    filter.assignee = null;
  } else if (assignee) {
    if (!isObjectId(assignee)) throw new AppError(400, "Invalid assignee filter");
    filter.assignee = assignee;
  }

  // Default: board order (position). ?sort=updated gives "recently changed first".
  const sort = req.query.sort === "updated" ? { updatedAt: -1 } : { position: 1, createdAt: 1 };
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 300, 1), 500);

  const [tasks, total] = await Promise.all([
    Task.find(filter).sort(sort).limit(limit).populate(POPULATE),
    Task.countDocuments(filter),
  ]);

  res.json({ tasks: tasks.map(toTaskDTO), total });
}

// POST /api/workspaces/:workspaceId/tasks
export async function createTask(req, res) {
  const {
    title,
    description = "",
    status = "todo",
    priority = "medium",
    assignee = null,
    dueDate = null,
  } = req.body;

  if (assignee) await assertWorkspaceMember(req.workspace._id, assignee);

  const task = await Task.create({
    workspace: req.workspace._id,
    title,
    description,
    status,
    priority,
    assignee,
    dueDate,
    position: await endPosition(req.workspace._id, status), // bottom of its column
    createdBy: req.user._id,
  });
  await task.populate(POPULATE);

  // Phase 8: broadcast "task:created". Phase 10: write an activity entry.
  // Phase 13: notify the assignee.
  res.status(201).json({ task: toTaskDTO(task) });
}

// GET /api/workspaces/:workspaceId/tasks/:taskId
export async function getTask(req, res) {
  const task = await Task.findOne(scoped(req, req.params.taskId)).populate(POPULATE);
  if (!task) throw notFound();

  res.json({ task: toTaskDTO(task) });
}

// PATCH /api/workspaces/:workspaceId/tasks/:taskId
// Last write wins, per field: only the fields you send are changed.
export async function updateTask(req, res) {
  const task = await Task.findOne(scoped(req, req.params.taskId));
  if (!task) throw notFound();

  const body = req.body;

  for (const field of ["title", "description", "priority", "dueDate"]) {
    if (body[field] !== undefined) task[field] = body[field];
  }

  if (body.assignee !== undefined) {
    if (body.assignee) await assertWorkspaceMember(req.workspace._id, body.assignee);
    task.assignee = body.assignee; // null = unassign
  }

  // A status change from the edit dialog sends the task to the bottom of the
  // new column. (Exact placement comes from the move endpoint below.)
  if (body.status !== undefined && body.status !== task.status) {
    task.status = body.status;
    task.position = await endPosition(req.workspace._id, body.status);
  }

  await task.save();
  await task.populate(POPULATE);

  // Phase 8: broadcast "task:updated". Phase 13: notify a new assignee.
  res.json({ task: toTaskDTO(task) });
}

// PATCH /api/workspaces/:workspaceId/tasks/:taskId/move
// Drag and drop: "put this task in <status>, right after <afterId>".
export async function moveTask(req, res) {
  const task = await Task.findOne(scoped(req, req.params.taskId));
  if (!task) throw notFound();

  const { status, afterId = null } = req.body;

  if (afterId && afterId === task.id) {
    throw new AppError(400, "A task can't be placed after itself");
  }

  task.position = await positionAfter(req.workspace._id, status, afterId, task._id);
  task.status = status;

  await task.save();
  await task.populate(POPULATE);

  // Phase 8: broadcast "task:moved". Phase 10: write an activity entry.
  res.json({ task: toTaskDTO(task) });
}

// DELETE /api/workspaces/:workspaceId/tasks/:taskId
// Owners and admins can delete any task. Members only their own.
export async function deleteTask(req, res) {
  const task = await Task.findOne(scoped(req, req.params.taskId));
  if (!task) throw notFound();

  const privileged = req.membership.role === ROLES.OWNER || req.membership.role === ROLES.ADMIN;
  if (!privileged && !task.createdBy.equals(req.user._id)) {
    throw new AppError(403, "You can only delete tasks you created");
  }

  await task.deleteOne();
  res.status(204).end();
}