"use client";

import { Kanban, Plus } from "lucide-react";
import DashboardCard, { EmptyHint } from "@/components/dashboard/DashboardCard";
import DashboardTaskRow from "@/components/dashboard/DashboardTaskRow";
import FormAlert from "@/components/auth/FormAlert";
import useWorkspace from "@/hooks/useWorkspace";
import { formatRelative } from "@/lib/format";

// recent: the useLoad result for "the newest changes". The server sorted it already.
export default function RecentTasksCard({ recent, onOpenTask, onCreateTask }) {
  const { workspace } = useWorkspace();

  return (
    <DashboardCard
      title="Recent tasks"
      action={{ href: `/workspaces/${workspace.id}/tasks`, label: "View board" }}
    >
      {recent.status === "loading" && (
        <div className="space-y-3" role="status" aria-live="polite">
          <div className="skeleton h-12 rounded-control" />
          <div className="skeleton h-12 rounded-control" />
          <span className="sr-only">Loading recent tasks</span>
        </div>
      )}

      {recent.status === "error" && (
        <div className="space-y-3">
          <FormAlert message={recent.error} />
          <button
            type="button"
            onClick={recent.retry}
            className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
          >
            Try again
          </button>
        </div>
      )}

      {recent.status === "ready" && recent.data.tasks.length === 0 && (
        <div className="space-y-4">
          <EmptyHint icon={Kanban} title="No tasks yet">
            Plan work on a board your whole team can see and move.
          </EmptyHint>
          <button
            type="button"
            onClick={onCreateTask}
            className="btn-ghost inline-flex items-center gap-2 rounded-control px-4 py-2 text-sm"
          >
            <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
            New task
          </button>
        </div>
      )}

      {recent.status === "ready" && recent.data.tasks.length > 0 && (
        <ul>
          {recent.data.tasks.map((task) => (
            <DashboardTaskRow
              key={task.id}
              task={task}
              onOpen={onOpenTask}
              detail={`Updated ${formatRelative(task.updatedAt)}`}
            />
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}