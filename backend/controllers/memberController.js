import Membership from "../models/Membership.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { isObjectId } from "../utils/objectId.js";
import { ROLES } from "../constants/roles.js";
import {
  toMemberDTO,
  sortMembers,
  canAssignRole,
  canRemoveMember,
} from "../services/memberService.js";

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

  // Phase 13: notify the new member. Phase 8: broadcast "member:added" over Socket.IO.
  res.status(201).json({ member: toMemberDTO(membership) });
}

// PATCH /api/workspaces/:workspaceId/members/:userId  (owner only)
export async function updateMemberRole(req, res) {
  const target = await findTarget(req);

  if (target.role === ROLES.OWNER) {
    throw new AppError(403, "The owner's role can't be changed");
  }

  target.role = req.body.role;
  await target.save();

  res.json({ member: toMemberDTO(target) });
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
  res.status(204).end();
}