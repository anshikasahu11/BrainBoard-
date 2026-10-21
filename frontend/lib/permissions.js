// Mirrors the backend's rules so the UI never offers a button that will fail.
// This is for convenience only: the backend enforces every rule regardless.

export const ROLE_LABELS = { owner: "Owner", admin: "Admin", member: "Member" };

const ASSIGNABLE = { owner: ["member", "admin"], admin: ["member"] };

// Roles you may give a NEW member.
export function assignableRoles(actorRole) {
  return ASSIGNABLE[actorRole] ?? [];
}

// Only the owner may change an existing member's role.
export const canChangeRoles = (actorRole) => actorRole === "owner";

// Owners remove admins and members. Admins remove members only.
// Nobody removes the owner.
export function canRemoveMember(actorRole, targetRole) {
  if (actorRole === "owner") return targetRole !== "owner";
  if (actorRole === "admin") return targetRole === "member";
  return false;
}

export const canRename = (role) => role === "owner" || role === "admin";
export const canDeleteWorkspace = (role) => role === "owner";
export const canLeaveWorkspace = (role) => role !== "owner";

// Owners and admins can delete any document. Members only their own.
export function canDeleteDocument(role, doc, userId) {
  if (role === "owner" || role === "admin") return true;
  return doc.createdBy?.id === userId;
}

// The same rule for tasks.
export function canDeleteTask(role, task, userId) {
  if (role === "owner" || role === "admin") return true;
  return task.createdBy?.id === userId;
}