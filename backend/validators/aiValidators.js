import { z } from "zod";
import { GOALS } from "../ai/snippetPrompts.js";
import { isRealDate } from "../ai/taskProposals.js";

const objectId = (message) => z.string({ error: message }).regex(/^[a-f0-9]{24}$/i, { error: message });

export const summarizeDocumentSchema = z.object({
  documentId: objectId("Choose a document to summarize"),
});

export const explainSnippetSchema = z.object({
  snippetId: objectId("Choose a snippet to explain"),
});

export const improveSnippetSchema = z.object({
  snippetId: objectId("Choose a snippet to improve"),
  goal: z.enum(GOALS, { error: "Choose a goal: general, readability, performance or bugs" }).optional(),
});

// Either notes pasted as text, or a document to read them from. Never both, never neither.
export const tasksFromTextSchema = z
  .object({
    text: z
      .string({ error: "Paste some notes to work from" })
      .trim()
      .min(1, { error: "Paste some notes to work from" })
      .max(100000, { error: "Those notes are too long. Paste a shorter section." })
      .optional(),
    documentId: objectId("Choose a document to work from").optional(),
    // The visitor's own date, so "by Friday" means the Friday they mean.
    today: z.string({ error: "today must be a date like 2026-12-31" }).refine(isRealDate, "today must be a real date like 2026-12-31").optional(),
  })
  .refine((data) => Boolean(data.text) !== Boolean(data.documentId), "Send either some notes or a document, not both");