import { AlertCircle, CalendarDays } from "lucide-react";
import { dueInfo } from "@/lib/tasks";

const TONES = {
  overdue: "bg-danger/15 text-danger",
  today: "bg-amber/15 text-amber",
  later: "bg-white/10 text-fg-2",
};

// A task's due date. Overdue and due-today get an extra word for screen readers,
// and overdue gets a different icon, so colour is never the only signal.
export default function DueChip({ dueDate, status }) {
  const due = dueInfo(dueDate, status);
  if (!due) return null;

  const Icon = due.state === "overdue" ? AlertCircle : CalendarDays;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-chip px-1.5 py-0.5 text-[11px] ${TONES[due.state]}`}
    >
      <Icon size={11} strokeWidth={2} aria-hidden="true" />
      {due.label}
      {due.state === "overdue" && <span className="sr-only"> (overdue)</span>}
      {due.state === "today" && <span className="sr-only"> (due today)</span>}
    </span>
  );
}