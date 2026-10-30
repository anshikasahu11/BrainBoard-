import Membership from "../models/Membership.js";
import User from "../models/User.js";
import Task from "../models/Task.js";
import AppError from "../utils/AppError.js";
import { isObjectId } from "../utils/objectId.js";
import { ROLES } from "../constants/roles.js";
import { announce, emitToUser, kickFromWorkspace } from "../socket/realtime.js";
import { recordActivity } from "../services/activityService.js";
import {
  toMemberDTO,
  sortMembers,
  canAssignRole,
  canRemoveMember,
} from "../services/memberService.js";

// What an activity entry says it was about: the person.
const memberTarget = (user) => ({ type: "member", id: user._id, name: user.name });

// Finds the membership for :userId inside the current workspace, or 404.
async function findTarget(req) {
  const notFound = new AppError(404, "Member not found");
  if (!isObjectId(req.params.userId)) throw notFound;

  const target = await Membership.findOne({
    workspace: req.workspace._id,
    user: req.params.userId,
  }).populate("user");

  if (!target || !target.user) throw notFound;
  return target;
}

// GET /api/workspaces/:workspaceId/members  (any member)
export async function listMembers(req, res) {
  const memberships = await Membership.find({ workspace: req.workspace._id }).populate("user");
  const members = memberships.filter((m) => m.user).map(toMemberDTO);
  res.json({ members: sortMembers(members) });
}

// POST /api/workspaces/:workspaceId/members  (owner or admin)
export async function addMember(req, res) {
  const { email, role } = req.body;

  // Check the role rule FIRST, so a forbidden request learns nothing about
  // which emails have accounts.
  if (!canAssignRole(req.membership.role, role)) {
    throw new AppError(403, "Only the owner can add admins");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError(404, "No BrainBoard account uses that email. Ask them to sign up first.");
  }

  const alreadyMember = await Membership.exists({
    workspace: req.workspace._id,
    user: user._id,
  });
  if (alreadyMember) {
    throw new AppError(409, `${user.name} is already a member of this workspace`);
  }

  const membership = await Membership.create({
    workspace: req.workspace._id,
    user: user._id,
    role,
  });
  await membership.populate("user");

  const member = toMemberDTO(membership);
  announce(req, "member:added", { member });
  // The new member's own screen can show the workspace straight away.
  emitToUser(user.id, "workspace:added", { workspaceId: req.workspace.id });
  await recordActivity(req, {
    action: "member.added",
    target: memberTarget(user),
    meta: { role },
  });

  // Phase 13: notify the new member.
  res.status(201).json({ member });
}

// PATCH /api/workspaces/:workspaceId/members/:userId  (owner only)
export async function updateMemberRole(req, res) {
  const target = await findTarget(req);

  if (target.role === ROLES.OWNER) {
    throw new AppError(403, "The owner's role can't be changed");
  }

  const previousRole = target.role;
  target.role = req.body.role;
  await target.save();

  // The server already uses the new role on the very next request. This lets the
  // affected person's screen catch up.
  const member = toMemberDTO(target);
  announce(req, "member:updated", { member });
  await recordActivity(req, {
    action: "member.role_changed",
    target: memberTarget(target.user),
    meta: { from: previousRole, role: target.role },
  });

  res.json({ member });
}

// DELETE /api/workspaces/:workspaceId/members/:userId
// Your own id = leave the workspace. Anyone else's id = remove them.
export async function removeMember(req, res) {
  const target = await findTarget(req);
  const isSelf = req.params.userId === req.user.id;

  if (isSelf) {
    if (target.role === ROLES.OWNER) {
      throw new AppError(400, "Owners can't leave their workspace. Delete it instead.");
    }
  } else if (!canRemoveMember(req.membership.role, target.role)) {
    throw new AppError(403, "You don't have permission to remove this member");
  }

  await target.deleteOne();

  // Someone with no access can't own any work: unassign their tasks here.
  await Task.updateMany(
    { workspace: req.workspace._id, assignee: target.user._id },
    { $set: { assignee: null } }
  );

  const reason = isSelf ? "left" : "removed";
  const workspaceId = req.workspace.id;
  const userId = target.user.id;

  // 1. The room hears about it (the person leaving is still in the room, so they do too).
  announce(req, "member:removed", { userId, reason });
  // 2. Boards refresh, because that person's tasks were just unassigned.
  announce(req, "tasks:refresh", {});
  // 3. The person is told their access is gone, on every tab they have open.
  emitToUser(userId, "workspace:access-lost", { workspaceId, reason });
  // 4. Their live connections are taken out of the workspace's room.
  await kickFromWorkspace(userId, workspaceId);
  // 5. The feed records it AFTER that, so the person who lost access doesn't receive the entry.
  await recordActivity(req, {
    action: isSelf ? "member.left" : "member.removed",
    target: memberTarget(target.user),
  });

  res.status(204).end();
}