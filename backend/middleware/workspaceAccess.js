import Membership from "../models/Membership.js";
import AppError from "../utils/AppError.js";

const OBJECT_ID = /^[a-f\d]{24}$/i;

// Runs on every route that has :workspaceId in its path. It confirms the
// signed-in user is a MEMBER of that workspace, then attaches:
//   req.workspace   the workspace document
//   req.membership  this user's membership, including their role
//
// Strangers get the same 404 whether the workspace doesn't exist or just
// isn't theirs, so nobody can probe for valid IDs.
export async function loadWorkspace(req, res, next) {
  const { workspaceId } = req.params;
  const notFound = new AppError(404, "Workspace not found");

  if (!OBJECT_ID.test(workspaceId)) throw notFound;

  const membership = await Membership.findOne({
    user: req.user._id,
    workspace: workspaceId,
  }).populate("workspace");

  if (!membership || !membership.workspace) throw notFound;

  req.membership = membership;
  req.workspace = membership.workspace;
  next();
}

// Usage: requireRole("owner", "admin") lets only those roles through.
// Must run AFTER loadWorkspace.
export function requireRole(...allowed) {
  return (req, res, next) => {
    if (!allowed.includes(req.membership.role)) {
      throw new AppError(403, "You don't have permission to do that");
    }
    next();
  };
}