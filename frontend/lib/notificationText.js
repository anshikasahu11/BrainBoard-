// How a notification is worded and where it leads. The server sends structured facts (who, what,
// where); the screen decides the words. Plain JavaScript with no imports, so it can be tested alone.
//
// A notification looks like:
//   { id, kind, read, readAt, createdAt,
//     actor: { id, name } | null,            (null for a reminder: nobody did it)
//     workspace: { id, name },
//     target: { type, id, name },
//     meta: { ... } }

const OBJECT_ID = /^[a-f0-9]{24}$/i;

const ROLE_PHRASE = { admin: "an admin", member: "a member", owner: "the owner" };
const ROLE_WORD = { admin: "admin", member: "member", owner: "owner" };

const plain = (text) => ({ text, strong: false });
const strong = (text) => ({ text, strong: true });

const who = (notification) => notification.actor?.name || "Someone";

// The sentence, as pieces: the names and titles are marked `strong` so the screen can emphasise
// them. `plain` is the same sentence as one string, for screen readers and announcements.
// Every piece is text, never markup: whatever is in a name or title is shown as it is.
export function notificationMessage(notification) {
  const task = notification.target?.name || "a task";
  const space = notification.workspace?.name || "a workspace";
  const meta = notification.meta ?? {};

  let segments;

  switch (notification.kind) {
    case "task.assigned":
      segments = [strong(who(notification)), plain(" assigned you "), strong(task)];
      break;

    case "task.due_soon": {
      const when = meta.days === 0 ? " is due today" : meta.days === 1 ? " is due tomorrow" : " is due soon";
      segments = [strong(task), plain(when)];
      break;
    }

    case "task.overdue": {
      const late = meta.daysLate;
      const tail =
        late === 1
          ? " is overdue (due yesterday)"
          : Number.isInteger(late) && late > 1
            ? ` is overdue (due ${late} days ago)`
            : " is overdue";
      segments = [strong(task), plain(tail)];
      break;
    }

    case "member.added": {
      const role = ROLE_PHRASE[meta.role];
      segments = [strong(who(notification)), plain(" added you to "), strong(space), ...(role ? [plain(` as ${role}`)] : [])];
      break;
    }

    case "member.role_changed": {
      const word = ROLE_WORD[meta.role];
      segments = [strong(who(notification)), plain(" changed your role in "), strong(space), ...(word ? [plain(` to ${word}`)] : [])];
      break;
    }

    case "member.removed":
      segments = [strong(who(notification)), plain(" removed you from "), strong(space)];
      break;

    default:
      segments = [plain("Something happened in "), strong(space)];
  }

  return { segments, plain: segments.map((piece) => piece.text).join("") };
}

// Where clicking it should go, or null when there's nowhere to go.
// Ids are checked before they go into an address.
export function notificationHref(notification) {
  const workspaceId = notification.workspace?.id;
  if (typeof workspaceId !== "string" || !OBJECT_ID.test(workspaceId)) return null;

  const base = `/workspaces/${workspaceId}`;

  switch (notification.kind) {
    case "task.assigned":
    case "task.due_soon":
    case "task.overdue": {
      const taskId = notification.target?.id;
      return typeof taskId === "string" && OBJECT_ID.test(taskId) ? `${base}/tasks?task=${taskId}` : `${base}/tasks`;
    }
    case "member.added":
      return base;
    case "member.role_changed":
      return `${base}/members`;
    case "member.removed":
      return null; // access is gone, so there's nowhere to go
    default:
      return base;
  }
}