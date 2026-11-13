import { z } from "zod";

export const summarizeDocumentSchema = z.object({
  documentId: z
    .string({ error: "Choose a document to summarize" })
    .regex(/^[a-f0-9]{24}$/i, { error: "Choose a document to summarize" }),
});