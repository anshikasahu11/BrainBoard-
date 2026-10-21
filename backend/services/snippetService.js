const PREVIEW_LINES = 12;
const PREVIEW_CHARS = 1000;

// Tidy code before it's stored: one kind of line ending everywhere, and no NUL characters.
export function cleanCode(code) {
  return code.replaceAll("\u0000", "").replace(/\r\n?/g, "\n");
}

// Facts about the code, worked out when it's saved, so the list can show a short
// preview without loading (or sending) the whole snippet.
export function derive(code) {
  const lines = code.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop(); // a trailing newline isn't another line

  let preview = lines.slice(0, PREVIEW_LINES).join("\n");
  let truncated = lines.length > PREVIEW_LINES;

  if (preview.length > PREVIEW_CHARS) {
    preview = preview.slice(0, PREVIEW_CHARS);
    truncated = true;
  }

  return { preview, lineCount: lines.length, truncated };
}

// ---------- The shapes the frontend receives ----------
// Always call .populate(...) before these, so the people are loaded.

function person(user) {
  return user?.id ? { id: user.id, name: user.name } : { id: null, name: "Former member" };
}

// For the list: a preview, never the full code.
export function toListItemDTO(snippet) {
  return {
    id: snippet.id,
    title: snippet.title,
    description: snippet.description,
    language: snippet.language,
    tags: snippet.tags,
    preview: snippet.preview,
    truncated: snippet.truncated,
    lineCount: snippet.lineCount,
    revision: snippet.revision,
    createdBy: person(snippet.createdBy),
    lastEditedBy: person(snippet.lastEditedBy),
    createdAt: snippet.createdAt,
    updatedAt: snippet.updatedAt,
  };
}

// For opening one snippet: everything, including the full code.
export function toSnippetDTO(snippet) {
  return {
    ...toListItemDTO(snippet),
    workspaceId: snippet.workspace.toString(),
    code: snippet.code,
  };
}