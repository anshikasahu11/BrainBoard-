import { z } from "zod";
import { PRIORITIES, STATUSES } from "../constants/tasks.js";

const title = z
  .string({ error: "Title is required" })
  .trim()
  .min(1, { error: "Title is required" })
  .max(140, { error: "Title must be 140 characters or fewer" });

const description = z
  .string({ error: "Description must be text" })
  .max(5000, { error: "Description must be 5000 characters or fewer" });

const status = z.enum(STATUSES, { error: "Choose a valid status" });
const priority = z.enum(PRIORITIES, { error: "Choose a valid priority" });

const objectId = z.string().regex(/^[a-f\d]{24}$/i, { error: "That isn't a valid id" });

// "2026-12-31": the right shape AND a real calendar date (no February 30th).
function isRealDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const dueDate = z
  .string({ error: "Due date must be a date" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Use the format YYYY-MM-DD" })
  .refine(isRealDate, { error: "Enter a real date" });

// Fields we don't list here (workspace, position, createdBy...) are dropped,
// so a hand-made request can't set them.
export const createTaskSchema = z.object({
  title,
  description: description.optional(),
  status: status.optional(),
  priority: priority.optional(),
  assignee: objectId.nullable().optional(),
  dueDate: dueDate.nullable().optional(),
});

// Only the fields you send are changed. null clears an assignee or a due date.
export const updateTaskSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
    status: status.optional(),
    priority: priority.optional(),
    assignee: objectId.nullable().optional(),
    dueDate: dueDate.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Nothing to update");

// "Put this task in <status>, right after <afterId>". No afterId (or null) = top of the column.
export const moveTaskSchema = z.object({
  status,
  afterId: objectId.nullable().optional(),
});