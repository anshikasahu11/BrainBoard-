// Helpers for reviewing AI-proposed tasks before any are created.
// Plain JavaScript with no imports, so it can be tested on its own.

export const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const PRIORITY_VALUES = PRIORITY_OPTIONS.map((option) => option.value);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const MAX_TITLE = 120;
export const MAX_DESCRIPTION = 1000;

// The server's proposals, as rows the person can edit.
//   tasks:   [{ title, description, priority, dueDate, assignee: { id, name } | null }]
//   members: [{ id, name }], the people who can be assigned today.
// A person who is no longer a member becomes "Unassigned" (assigneeId ""). Nothing in the
// input list is changed.
export function toDrafts(tasks, members) {
  const ids = new Set(members.map((member) => member.id));

  return tasks.map((task, index) => ({
    key: `p${index}`,
    include: true,
    title: String(task.title ?? ""),
    description: String(task.description ?? ""),
    priority: PRIORITY_VALUES.includes(task.priority) ? task.priority : "medium",
    dueDate: DATE.test(task.dueDate ?? "") ? task.dueDate : "",
    assigneeId: task.assignee && ids.has(task.assignee.id) ? task.assignee.id : "",
    error: "",
  }));
}

// What's wrong with a title, in words, or "" when it's fine.
export function titleProblem(title) {
  const text = String(title ?? "").trim();
  if (!text) return "Give this task a title";
  if (text.length > MAX_TITLE) return `Keep the title to ${MAX_TITLE} characters or fewer`;
  return "";
}

export const includedDrafts = (drafts) => drafts.filter((draft) => draft.include);

// { key: problem } for the rows that are ticked and have a problem. Unticked rows are ignored:
// they won't be added, so they can stay as they are.
export function draftProblems(drafts) {
  const problems = {};
  for (const draft of drafts) {
    if (!draft.include) continue;

    const problem = titleProblem(draft.title);
    if (problem) problems[draft.key] = problem;
  }
  return problems;
}

// Exactly what is sent to the task endpoint, and nothing else.
export function toTaskPayload(draft) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    priority: PRIORITY_VALUES.includes(draft.priority) ? draft.priority : "medium",
    assignee: draft.assigneeId || null,
    dueDate: DATE.test(draft.dueDate) ? draft.dueDate : null,
  };
}

export const countLabel = (count) => `${count} ${count === 1 ? "task" : "tasks"}`;

// What to say after adding. Empty when nothing was tried.
export function addingMessage({ added, failed }) {
  if (added > 0 && failed === 0) return `Added ${countLabel(added)}.`;
  if (added > 0) return `Added ${countLabel(added)}. ${failed} couldn’t be added.`;
  if (failed === 1) return "Couldn’t add that task.";
  if (failed > 1) return "Couldn’t add any of the tasks.";
  return "";
}