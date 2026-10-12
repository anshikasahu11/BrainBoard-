import { z } from "zod";

// Trim and lowercase first, then check that it looks like an email.
const email = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address" }));

const newPassword = z
  .string({ error: "Password is required" })
  .min(8, { error: "Password must be at least 8 characters" })
  .max(72, { error: "Password must be 72 characters or fewer" })
  .regex(/[A-Za-z]/, { error: "Password must include a letter" })
  .regex(/[0-9]/, { error: "Password must include a number" });

export const registerSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .trim()
    .min(2, { error: "Name must be at least 2 characters" })
    .max(50, { error: "Name must be 50 characters or fewer" }),
  email,
  password: newPassword,
});

// Login only checks that something was entered. The real check is against the database.
export const loginSchema = z.object({
  email,
  password: z.string({ error: "Password is required" }).min(1, { error: "Password is required" }),
});