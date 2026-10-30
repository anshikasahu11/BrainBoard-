// Everything the activity feed can record. The feed is written by the server only.

export const ACTIONS = [
  "workspace.created",
  "workspace.renamed",
  "member.added",
  "member.role_changed",
  "member.removed",
  "member.left",
  "document.created",
  "document.renamed",
  "document.updated",
  "document.deleted",
  "version.saved",
  "version.restored",
  "version.deleted",
  "task.created",
  "task.moved",
  "task.assigned",
  "task.unassigned",
  "task.updated",
  "task.deleted",
  "snippet.created",
  "snippet.updated",
  "snippet.deleted",
];

// The filter groups on the Activity page.
export const CATEGORIES = ["documents", "tasks", "snippets", "team"];

// What an entry is about. (Versions are about their document.)
export const TARGET_KINDS = ["document", "task", "snippet", "member", "workspace"];

const CATEGORY_OF = {
  workspace: "team",
  member: "team",
  document: "documents",
  version: "documents",
  task: "tasks",
  snippet: "snippets",
};

export const categoryOf = (action) => CATEGORY_OF[action.split(".")[0]];

// Repeated edits to the same thing by the same person are recorded once per this long.
export const THROTTLE_MS = 30 * 60 * 1000;

// Entries older than this are removed by the database itself.
export const RETENTION_DAYS = 180;