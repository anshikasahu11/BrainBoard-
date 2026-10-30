import Workspace from "../models/Workspace.js";
import Membership from "../models/Membership.js";
import { ROLES } from "../constants/roles.js";
import { announce, closeWorkspaceRoom } from "../socket/realtime.js";
import { recordActivity } from "../services/activityService.js";
import { deleteWorkspaceCascade, toWorkspaceDTO } from "../services/workspaceService.js";

const workspaceTarget = (workspace) => ({ type: "workspace", id: workspace._id, name: workspace.name });

// POST /api/workspaces
export async function createWorkspace(req, res) {
  const workspace = await Workspace.create({
    name: req.body.name,
    owner: req.user._id,
  });

  // The creator becomes the owner. If this fails, remove the workspace
  // again so we never leave one that nobody can open.
  try {
    await Membership.create({
      user: req.user._id,
      workspace: workspace._id,
      role: ROLES.OWNER,
    });
  } catch (error) {
    await Workspace.findByIdAndDelete(workspace._id);
    throw error;
  }

  // The first line of the workspace's history. (This route has no loaded workspace yet, so it's named.)
  await recordActivity(req, {
    workspaceId: workspace._id,
    action: "workspace.created",
    target: workspaceTarget(workspace),
  });

  res.status(201).json({ workspace: toWorkspaceDTO(workspace, ROLES.OWNER, 1) });
}

// GET /api/workspaces  (only the workspaces the signed-in user belongs to)
export async function listWorkspaces(req, res) {
  const memberships = await Membership.find({ user: req.user._id })
    .populate("workspace")
    .sort({ createdAt: 1 });

  // Skip any membership whose workspace no longer exists.
  const mine = memberships.filter((m) => m.workspace);

  // Count members per workspace in one query.
  const counts = await Membership.aggregate([
    { $match: { workspace: { $in: mine.map((m) => m.workspace._id) } } },
    { $group: { _id: "$workspace", count: { $sum: 1 } } },
  ]);
  const countById = new Map(counts.map((c) => [c._id.toString(), c.count]));

  res.json({
    workspaces: mine.map((m) =>
      toWorkspaceDTO(m.workspace, m.role, countById.get(m.workspace.id) ?? 1)
    ),
  });
}

// GET /api/workspaces/:workspaceId
export async function getWorkspace(req, res) {
  const memberCount = await Membership.countDocuments({ workspace: req.workspace._id });
  res.json({ workspace: toWorkspaceDTO(req.workspace, req.membership.role, memberCount) });
}

// PATCH /api/workspaces/:workspaceId  (owner or admin)
export async function renameWorkspace(req, res) {
  const previousName = req.workspace.name;

  req.workspace.name = req.body.name;
  await req.workspace.save();

  // Only what's the same for everyone: the workspace data you get over REST also
  // has YOUR role and the member count, which differ from person to person.
  announce(req, "workspace:updated", {
    name: req.workspace.name,
    updatedAt: req.workspace.updatedAt,
  });

  if (previousName !== req.workspace.name) {
    await recordActivity(req, {
      action: "workspace.renamed",
      target: workspaceTarget(req.workspace),
      meta: { from: previousName, to: req.workspace.name },
    });
  }

  const memberCount = await Membership.countDocuments({ workspace: req.workspace._id });
  res.json({ workspace: toWorkspaceDTO(req.workspace, req.membership.role, memberCount) });
}

// DELETE /api/workspaces/:workspaceId  (owner only)
export async function deleteWorkspace(req, res) {
  const workspaceId = req.workspace.id;

  // The workspace's history goes with it (see deleteWorkspaceCascade).
  await deleteWorkspaceCascade(req.workspace._id);

  // Tell everyone in the room first, then empty it: nobody stays subscribed to
  // a workspace that no longer exists.
  announce(req, "workspace:deleted", {});
  closeWorkspaceRoom(workspaceId);

  res.status(204).end();
}