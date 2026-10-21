import { z } from "zod";
import { LANGUAGES, MAX_CODE_LENGTH, MAX_TAGS } from "../constants/snippets.js";

const title = z
  .string({ error: "Title is required" })
  .trim()
  .min(1, { error: "Title is required" })
  .max(120, { error: "Title must be 120 characters or fewer" });

const description = z
  .string({ error: "Description must be text" })
  .trim()
  .max(1000, { error: "Description must be 1000 characters or fewer" });

// The code itself is never trimmed: leading spaces are its indentation.
const code = z
  .string({ error: "Code is required" })
  .min(1, { error: "Code is required" })
  .max(MAX_CODE_LENGTH, {
    error: `Code must be ${MAX_CODE_LENGTH.toLocaleString("en-US")} characters or fewer`,
  })
  .refine((value) => value.trim().length > 0, { error: "Code can't be empty" });

const language = z.enum(LANGUAGES, { error: "Choose a supported language" });

// Tidy each tag first (trim, lowercase), then check it. Duplicates are dropped.
const tag = z
  .string({ error: "Tags must be text" })
  .trim()
  .toLowerCase()
  .pipe(
    z.string().regex(/^[a-z0-9][a-z0-9 .+#_-]{0,29}$/, {
      error: "Tags use letters, numbers and . + # _ - and are up to 30 characters",
    })
  );

const tags = z
  .array(tag, { error: "Tags must be a list" })
  .max(MAX_TAGS, { error: `Use at most ${MAX_TAGS} tags` })
  .transform((list) => [...new Set(list)]);

// Fields we don't list here (workspace, preview, createdBy...) are dropped,
// so a hand-made request can't set them.
export const createSnippetSchema = z.object({
  title,
  description: description.optional(),
  code,
  language: language.optional(),
  tags: tags.optional(),
});

export const updateSnippetSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
    code: code.optional(),
    language: language.optional(),
    tags: tags.optional(),
    // The revision the client was editing. Used to detect edit conflicts.
    baseRevision: z
      .number({ error: "baseRevision is required" })
      .int({ error: "baseRevision must be a whole number" })
      .min(0, { error: "baseRevision must be 0 or more" }),
  })
  .refine(
    (data) => ["title", "description", "code", "language", "tags"].some((key) => data[key] !== undefined),
    "Nothing to update"
  );