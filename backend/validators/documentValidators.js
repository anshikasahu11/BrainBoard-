import { z } from "zod";

const title = z
  .string({ error: "Title must be text" })
  .trim()
  .min(1, { error: "Title can't be empty" })
  .max(120, { error: "Title must be 120 characters or fewer" });

export const createDocumentSchema = z.object({
  title: title.optional(),
});

// content is checked in depth by cleanContent() in documentService.js.
export const updateDocumentSchema = z
  .object({
    title: title.optional(),
    content: z.any().optional(),
    // The revision the client was editing. Used to detect edit conflicts.
    baseRevision: z
      .number({ error: "baseRevision is required" })
      .int({ error: "baseRevision must be a whole number" })
      .min(0, { error: "baseRevision must be 0 or more" }),
  })
  .refine((data) => data.title !== undefined || data.content !== undefined, "Nothing to update");