// Turns the server's structured activity entries into sentences, groups them by day,
// and decides whether a live entry belongs in the filtered list on screen.
// Plain JavaScript with no app imports, so it can be tested on its own.

import { formatDayLabel } from "./format.js";

const STATUS_LABELS = { todo: "To do", in_progress: "In progress", review: "Review", done: "Done" };
const ROLE_LABELS = { owner: "Owner", admin: "Admin", member: "Member" };
const ROLE_PHRASES = { owner: "an owner", admin: "an admin", member: "a member" };
const CATEGORY_LABELS = {
  documents: "Documents",
  tasks: "Tasks",
  snippets: "Snippets",
  team: "Team",
};

export const categoryLabel = (category) => CATEGORY_LABELS[category] ?? "Activity";

// A sentence is a list of pieces:
//   { text }                              plain words
//   { text, strong: true }                a name, in bold
//   { text, strong: true, href }          a name that links somewhere
// ctx: { workspaceId, userId, linkTarget }. The person looking at the feed is "You".
//   linkTarget (default true): set it to false where every entry is about the same
//   document (its own history panel), so its name isn't a link to the page you're on.
export function describeActivity(activity, { workspaceId, userId, linkTarget = true }) {
  const { action, actor, target } = activity;
  const meta = activity.meta ?? {};
  const base = `/workspaces/${workspaceId}`;
  const isMe = (id) => Boolean(userId) && id === userId;

  const text = (value) => ({ text: value });
  const strong = (value, href) => (href ? { text: value, strong: true, href } : { text: value, strong: true });
  const label = (fallback) => target.name || fallback;

  const who = strong(isMe(actor.id) ? "You" : actor.name);

  // A deleted document isn't linked below (there's nowhere to go).
  const doc = () => strong(label("Untitled"), linkTarget ? `${base}/documents/${target.id}` : undefined);
  const task = () => strong(label("an untitled task"), `${base}/tasks`);
  const snippet = () => strong(label("an untitled snippet"), `${base}/snippets`);
  const person = () => (isMe(target.id) ? text("you") : strong(target.name, `${base}/members`));
  const possessive = () =>
    isMe(target.id) ? text("your") : strong(`${target.name}’s`, `${base}/members`);
  const status = (value) => strong(STATUS_LABELS[value] ?? String(value ?? ""));
  const role = (value) => strong(ROLE_LABELS[value] ?? String(value ?? ""));
  const version = meta.number ?? "?";

  switch (action) {
    case "workspace.created":
      return [who, text(" created the workspace "), strong(label("this workspace"))];
    case "workspace.renamed":
      return [
        who,
        text(" renamed the workspace from "),
        strong(meta.from ?? ""),
        text(" to "),
        strong(meta.to ?? ""),
      ];

    case "member.added":
      return [who, text(" added "), person(), text(` as ${ROLE_PHRASES[meta.role] ?? "a member"}`)];
    case "member.role_changed":
      return [
        who,
        text(" changed "),
        possessive(),
        text(" role from "),
        role(meta.from),
        text(" to "),
        role(meta.role),
      ];
    case "member.removed":
      return [who, text(" removed "), person()];
    case "member.left":
      return [who, text(" left the workspace")];

    case "document.created":
      return [who, text(" created "), doc()];
    case "document.renamed":
      return [who, text(" renamed "), strong(meta.from ?? "a document"), text(" to "), doc()];
    case "document.updated":
      return [who, text(" edited "), doc()];
    case "document.deleted":
      return [who, text(" deleted "), strong(label("a document"))];

    case "version.saved":
      return [
        who,
        text(` saved version ${version} of `),
        doc(),
        ...(meta.label ? [text(` (“${meta.label}”)`)] : []),
      ];
    case "version.restored":
      return [who, text(` restored version ${version} of `), doc()];
    case "version.deleted":
      return [who, text(` deleted version ${version} of `), doc()];

    case "task.created":
      return [who, text(" created the task "), task()];
    case "task.moved":
      return [who, text(" moved "), task(), text(" from "), status(meta.from), text(" to "), status(meta.to)];
    case "task.assigned":
      return [
        who,
        text(" assigned "),
        task(),
        text(" to "),
        isMe(meta.assigneeId) ? text("you") : strong(meta.assigneeName ?? "someone"),
      ];
    case "task.unassigned":
      return [who, text(" unassigned "), task()];
    case "task.updated":
      return [who, text(" edited the task "), task()];
    case "task.deleted":
      return [who, text(" deleted the task "), strong(label("an untitled task"))];

    case "snippet.created":
      return [who, text(" saved the snippet "), snippet()];
    case "snippet.updated":
      return [who, text(" edited the snippet "), snippet()];
    case "snippet.deleted":
      return [who, text(" deleted the snippet "), strong(label("an untitled snippet"))];

    default:
      // An action this screen doesn't know yet: still say something sensible.
      return [who, text(` ${String(action).replace(".", " ")} `), strong(label(""))];
  }
}

// The same sentence as plain text (for screen readers and announcements).
export const plainText = (segments) => segments.map((segment) => segment.text).join("").trim();

// Entries are newest first. This splits them into days: [{ key, label, items }].
export function groupByDay(items) {
  const groups = [];

  for (const item of items) {
    const key = new Date(item.createdAt).toDateString();
    const last = groups[groups.length - 1];

    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: formatDayLabel(item.createdAt), items: [item] });
  }

  return groups;
}

// Does a live entry belong in the list that's on screen (with its filters)?
export function matchesFilters(activity, { category = "", actor = "", target = "" }, userId) {
  if (category && activity.category !== category) return false;

  if (actor === "me") {
    if (activity.actor.id !== userId) return false;
  } else if (actor && activity.actor.id !== actor) {
    return false;
  }

  if (target && activity.target.id !== target) return false;
  return true;
}