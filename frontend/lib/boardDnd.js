import { STATUSES } from "@/lib/tasks";

// Helpers for the drag-and-drop board. The board keeps its cards as "groups":
//   { todo: [taskId, ...], in_progress: [...], review: [...], done: [...] }
// and these small functions move ids around inside it.

const PREFIX = "column:";

// Columns are drop targets too, so an EMPTY column can receive a card.
export const columnId = (status) => `${PREFIX}${status}`;
export const isColumnId = (id) => typeof id === "string" && id.startsWith(PREFIX);
export const statusFromColumnId = (id) => id.slice(PREFIX.length);

// Builds the groups from the board's task list (keeping the order).
export function groupIds(tasks) {
  const groups = Object.fromEntries(STATUSES.map((s) => [s.value, []]));
  for (const task of tasks) groups[task.status]?.push(task.id);
  return groups;
}

// Which column holds this card? (A column id answers with itself.)
export function findColumn(groups, id) {
  if (isColumnId(id)) return statusFromColumnId(id);
  return STATUSES.find((s) => groups[s.value].includes(id))?.value ?? null;
}

// While dragging: when the card is held over something in ANOTHER column, move it
// into that column. (Reordering inside one column is settled when you drop.)
// isBelow: the card is lower than the middle of the one it's over, so it goes after it.
export function moveOver(groups, activeId, overId, isBelow) {
  const from = findColumn(groups, activeId);
  const to = findColumn(groups, overId);
  if (!from || !to || from === to) return groups;

  const source = groups[from].filter((id) => id !== activeId);
  const target = [...groups[to]];

  let index = target.length; // over the column itself: the bottom
  if (!isColumnId(overId)) {
    index = target.indexOf(overId) + (isBelow ? 1 : 0);
  }
  target.splice(index, 0, activeId);

  return { ...groups, [from]: source, [to]: target };
}

// Where a card sits, in the words the server understands:
// "in this column, right after that card" (or at the top: afterId null).
export function placementOf(groups, id) {
  const status = findColumn(groups, id);
  if (!status) return null;

  const list = groups[status];
  const index = list.indexOf(id);
  return { status, afterId: index > 0 ? list[index - 1] : null };
}

export const samePlacement = (a, b) =>
  Boolean(a && b && a.status === b.status && a.afterId === b.afterId);

// Writes the groups back into a task list: new column, new order.
export function applyGroups(tasks, groups) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const result = [];
  const seen = new Set();

  for (const { value } of STATUSES) {
    for (const id of groups[value] ?? []) {
      const task = byId.get(id);
      if (task) {
        result.push({ ...task, status: value });
        seen.add(id);
      }
    }
  }
  for (const task of tasks) if (!seen.has(task.id)) result.push(task);
  return result;
}