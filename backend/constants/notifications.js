// Everything a notification can be. Notifications are written by the server only.

// Each kind: what it's called in settings, what it means, whether repeats are collapsed
// (throttleMs), and whether the person must still be a member when it's created.
export const KINDS = {
  "task.assigned": {
    label: "Tasks assigned to you",
    description: "When someone assigns a task to you.",
    throttleMs: 10 * 60 * 1000, // assigning the same task to you again within 10 minutes counts once
    recipientMustBeMember: true,
  },
  "task.due_soon": {
    label: "Tasks due soon",
    description: "When a task assigned to you is due today or tomorrow.",
    throttleMs: 0, // protected instead by a once-only key (see services/reminderService.js)
    recipientMustBeMember: true,
  },
  "task.overdue": {
    label: "Overdue tasks",
    description: "When a task assigned to you has passed its due date.",
    throttleMs: 0, // protected instead by a once-only key (see services/reminderService.js)
    recipientMustBeMember: true,
  },
  "member.added": {
    label: "Added to a workspace",
    description: "When someone adds you to a workspace.",
    throttleMs: 0,
    recipientMustBeMember: true,
  },
  "member.role_changed": {
    label: "Role changes",
    description: "When your role in a workspace changes.",
    throttleMs: 0, // never collapsed: you must always see the latest role
    recipientMustBeMember: true,
  },
  "member.removed": {
    label: "Removed from a workspace",
    description: "When someone removes you from a workspace.",
    throttleMs: 0,
    recipientMustBeMember: false, // by definition, they're no longer a member
  },
};

export const KIND_LIST = Object.keys(KINDS);

// What a notification is about.
export const TARGET_TYPES = ["task", "workspace"];

// Notifications are removed by the database itself after this long.
export const RETENTION_DAYS = 90;

export const DEFAULT_PAGE = 20;
export const MAX_PAGE = 100;