import {
  ArrowDown,
  ArrowUp,
  ChevronsUp,
  Circle,
  CircleCheck,
  CircleDot,
  Eye,
  Minus,
} from "lucide-react";

// The four columns, in board order. `value` matches the backend.
export const STATUSES = [
  { value: "todo", label: "To do", icon: Circle, tone: "text-fg-muted" },
  { value: "in_progress", label: "In progress", icon: CircleDot, tone: "text-petrol-300" },
  { value: "review", label: "Review", icon: Eye, tone: "text-amber" },
  { value: "done", label: "Done", icon: CircleCheck, tone: "text-success" },
];

// Each priority has an icon AND a word, never colour alone.
export const PRIORITIES = [
  { value: "low", label: "Low", icon: ArrowDown, classes: "bg-white/10 text-fg-2" },
  { value: "medium", label: "Medium", icon: Minus, classes: "bg-copper/15 text-copper" },
  { value: "high", label: "High", icon: ArrowUp, classes: "bg-ember-500/15 text-ember-300" },
  { value: "urgent", label: "Urgent", icon: ChevronsUp, classes: "bg-danger/15 text-danger" },
];

export const statusInfo = (value) => STATUSES.find((s) => s.value === value) ?? STATUSES[0];
export const priorityInfo = (value) => PRIORITIES.find((p) => p.value === value) ?? PRIORITIES[1];

const pad = (n) => String(n).padStart(2, "0");

// Today's date as "YYYY-MM-DD", in the visitor's own time zone.
export function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Turns a plain due date ("2026-12-31") into { label: "Dec 31", state }.
// state: "overdue" | "today" | "later". Finished tasks are never overdue.
export function dueInfo(dueDate, status) {
  if (!dueDate) return null;

  const [year, month, day] = dueDate.split("-").map(Number);
  const date = new Date(year, month - 1, day); // local date, so no time-zone shift
  const sameYear = year === new Date().getFullYear();
  const label = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });

  let state = "later";
  if (status !== "done") {
    const today = todayISO();
    if (dueDate < today) state = "overdue";
    else if (dueDate === today) state = "today";
  }
  return { label, state };
}