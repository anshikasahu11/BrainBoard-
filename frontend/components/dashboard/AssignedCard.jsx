"use client";

import { UserCheck } from "lucide-react";
import DashboardCard, { EmptyHint } from "@/components/dashboard/DashboardCard";
import DashboardTaskRow from "@/components/dashboard/DashboardTaskRow";
import FormAlert from "@/components/auth/FormAlert";
import useWorkspace from "@/hooks/useWorkspace";

const SHOW = 5;
const RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

// What to do next comes first: earliest due date (so overdue work leads), then
// tasks with no date, and ties go to the higher priority and the newest change.
function byUrgency(a, b) {
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  if (a.dueDate && !b.dueDate) return -1;
  if (!a.dueDate && b.dueDate) return 1;
  return RANK[a.priority] - RANK[b.priority] || new Date(b.updatedAt) - new Date(a.updatedAt);
}

// assigned: the useLoad result for "my open tasks".
export default function AssignedCard({ assigned, onOpenTask }) {
  const { workspace } = useWorkspace();

  const tasks = assigned.status === "ready" ? [...assigned.data.tasks].sort(byUrgency) : [];
  const shown = tasks.slice(0, SHOW);
  const extra = assigned.status === "ready" ? assigned.data.total - shown.length : 0;

  return (
    <DashboardCard
      title="Assigned to you"
      featured
      action={{ href: `/workspaces/${workspace.id}/tasks`, label: "View board" }}
    >
      {assigned.status === "loading" && (
        <div className="space-y-3" role="status" aria-live="polite">
          <div className="skeleton h-12 rounded-control" />
          <div className="skeleton h-12 rounded-control" />
          <span className="sr-only">Loading your tasks</span>
        </div>
      )}

      {/* Never show "nothing assigned" when the real problem is a failed request. */}
      {assigned.status === "error" && (
        <div className="space-y-3">
          <FormAlert message={assigned.error} />
          <button
            type="button"
            onClick={assigned.retry}
            className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
          >
            Try again
          </button>
        </div>
      )}

      {assigned.status === "ready" && shown.length === 0 && (
        <EmptyHint icon={UserCheck} title="Nothing assigned to you">
          Open tasks assigned to you will show up here, most urgent first.
        </EmptyHint>
      )}

      {assigned.status === "ready" && shown.length > 0 && (
        <>
          <ul>
            {shown.map((task) => (
              <DashboardTaskRow key={task.id} task={task} onOpen={onOpenTask} />
            ))}
          </ul>
          {extra > 0 && <p className="mt-3 text-[12px] text-fg-muted">+{extra} more on the board</p>}
        </>
      )}
    </DashboardCard>
  );
}