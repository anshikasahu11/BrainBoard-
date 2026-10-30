import Workspace from "../models/Workspace.js";
import Membership from "../models/Membership.js";
import Document from "../models/Document.js";
import DocumentVersion from "../models/DocumentVersion.js";
import Task from "../models/Task.js";
import Snippet from "../models/Snippet.js";
import Activity from "../models/Activity.js";

// Deleting a workspace must remove everything that belongs to it.
// Later phases add one line each here (notifications...).
export async function deleteWorkspaceCascade(workspaceId) {
  // The workspace goes first, so nobody can reach a half-deleted workspace
  // if the cleanup below is interrupted.
  await Workspace.findByIdAndDelete(workspaceId);
  await Membership.deleteMany({ workspace: workspaceId });
  await Document.deleteMany({ workspace: workspaceId });
  await DocumentVersion.deleteMany({ workspace: workspaceId });
  await Task.deleteMany({ workspace: workspaceId });
  await Snippet.deleteMany({ workspace: workspaceId });
  await Activity.deleteMany({ workspace: workspaceId });
}

// The shape the frontend receives. Never send raw database objects.
export function toWorkspaceDTO(workspace, role, memberCount) {
  return {
    id: workspace.id,
    name: workspace.name,
    ownerId: workspace.owner.toString(),
    role,
    memberCount,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}