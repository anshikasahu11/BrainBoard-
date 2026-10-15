import { z } from "zod";

// Used for both creating and renaming a workspace.
export const workspaceSchema = z.object({
  name: z
    .string({ error: "Workspace name is required" })
    .trim()
    .min(2, { error: "Name must be at least 2 characters" })
    .max(50, { error: "Name must be 50 characters or fewer" }),
});

// "owner" is deliberately not allowed: every workspace has exactly one owner.
const assignableRole = z.enum(["admin", "member"], {
  error: "Role must be admin or member",
});

export const addMemberSchema = z.object({
  email: z
    .string({ error: "Email is required" })
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Enter a valid email address" })),
  role: assignableRole.default("member"),
});

export const updateRoleSchema = z.object({
  role: assignableRole,
});