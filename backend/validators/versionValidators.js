import { z } from "zod";
import { MAX_LABEL_LENGTH } from "../constants/versions.js";

// A name for a saved version, like "Release candidate". Optional.
export const createVersionSchema = z.object({
  label: z
    .string({ error: "Name must be text" })
    .trim()
    .max(MAX_LABEL_LENGTH, { error: `Name must be ${MAX_LABEL_LENGTH} characters or fewer` })
    .optional(),
});

// Restoring changes the document, so it carries the revision you were looking at,
// like every other save.
export const restoreVersionSchema = z.object({
  baseRevision: z
    .number({ error: "baseRevision is required" })
    .int({ error: "baseRevision must be a whole number" })
    .min(0, { error: "baseRevision must be 0 or more" }),
});