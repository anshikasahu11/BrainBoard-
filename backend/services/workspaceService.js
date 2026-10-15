import Workspace from "../models/Workspace.js";
import Membership from "../models/Membership.js";

// Deleting a workspace must remove everything that belongs to it.
// Later phases add one line each here (documents, tasks, snippets, activity...).
export async function deleteWorkspaceCascade(workspaceId) {
  // The workspace goes first, so nobody can reach a half-deleted workspace
  // if the cleanup below is interrupted.
  await Workspace.findByIdAndDelete(workspaceId);
  await Membership.deleteMany({ workspace: workspaceId });
  // Phase 5: await Document.deleteMany({ workspace: workspaceId });
  // Phase 6: await Task.deleteMany({ workspace: workspaceId });
  // Phase 7: await Snippet.deleteMany({ workspace: workspaceId });
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