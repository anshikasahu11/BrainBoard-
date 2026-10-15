import { ROLES } from "../constants/roles.js";

const ORDER = { [ROLES.OWNER]: 0, [ROLES.ADMIN]: 1, [ROLES.MEMBER]: 2 };

// The shape the frontend receives for one person in a workspace.
export function toMemberDTO(membership) {
  const { user } = membership;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    role: membership.role,
    joinedAt: membership.createdAt,
  };
}

// Owner first, then admins, then members. Earlier joiners first within a role.
export function sortMembers(members) {
  return [...members].sort(
    (a, b) => ORDER[a.role] - ORDER[b.role] || new Date(a.joinedAt) - new Date(b.joinedAt)
  );
}

// ---------- The permission rules, in one place ----------

// Can someone with actorRole give a new member the role newRole?
// Owners can add admins and members. Admins can add members only.
export function canAssignRole(actorRole, newRole) {
  if (actorRole === ROLES.OWNER) return newRole === ROLES.ADMIN || newRole === ROLES.MEMBER;
  if (actorRole === ROLES.ADMIN) return newRole === ROLES.MEMBER;
  return false;
}

// Can someone with actorRole remove someone who has targetRole?
// Owners can remove admins and members. Admins can remove members only.
// Nobody can remove the owner.
export function canRemoveMember(actorRole, targetRole) {
  if (actorRole === ROLES.OWNER) return targetRole !== ROLES.OWNER;
  if (actorRole === ROLES.ADMIN) return targetRole === ROLES.MEMBER;
  return false;
}