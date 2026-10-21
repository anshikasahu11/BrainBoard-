"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import Reveal from "@/components/Reveal";
import FormAlert from "@/components/auth/FormAlert";
import RoleBadge from "@/components/workspaces/RoleBadge";
import QuickActions from "@/components/dashboard/QuickActions";
import GettingStarted from "@/components/dashboard/GettingStarted";
import StatsRow from "@/components/dashboard/StatsRow";
import TeamCard from "@/components/dashboard/TeamCard";
import AssignedCard from "@/components/dashboard/AssignedCard";
import RecentDocumentsCard from "@/components/dashboard/RecentDocumentsCard";
import RecentTasksCard from "@/components/dashboard/RecentTasksCard";
import TaskDialogHost from "@/components/dashboard/TaskDialogHost";
import useAuth from "@/hooks/useAuth";
import useCreateDocument from "@/hooks/useCreateDocument";
import useLoad from "@/hooks/useLoad";
import useRecentDocuments from "@/hooks/useRecentDocuments";
import useWorkspace from "@/hooks/useWorkspace";
import { getTaskStatsRequest, listTasksRequest } from "@/services/taskService";
import { getGreeting } from "@/lib/greeting";
import { formatDate } from "@/lib/format";
import { todayISO } from "@/lib/tasks";

export default function DashboardOverview() {
  const { workspace } = useWorkspace();
  const { user } = useAuth();

  // Loaded once and shared, so cards and the checklist always agree.
  const recentDocs = useRecentDocuments(workspace.id);
  const { create, creating, error: createError } = useCreateDocument(workspace.id);

  // Each task card loads (and fails) on its own.
  const stats = useLoad(`task-stats:${workspace.id}`, () =>
    getTaskStatsRequest(workspace.id, todayISO())
  );
  const assigned = useLoad(`task-assigned:${workspace.id}`, () =>
    listTasksRequest(workspace.id, { assignee: "me", status: "open", limit: 100 })
  );
  const recentTasks = useLoad(`task-recent:${workspace.id}`, () =>
    listTasksRequest(workspace.id, { sort: "updated", limit: 5 })
  );

  const [taskDialog, setTaskDialog] = useState(null); // {} to create, { task } to edit, or null
  const [notice, setNotice] = useState("");

  function openNewTask() {
    setNotice("");
    setTaskDialog({});
  }

  function openTask(task) {
    setNotice("");
    setTaskDialog({ task });
  }

  // After any change, close the dialog and refresh all three task cards together.
  function finish(message) {
    setTaskDialog(null);
    setNotice(message);
    stats.reload();
    assigned.reload();
    recentTasks.reload();
  }

  const firstName = user.name.split(" ")[0];
  const members = `${workspace.memberCount} ${workspace.memberCount === 1 ? "member" : "members"}`;

  return (
    <div>
      <Reveal level="balanced">
        <p className="eyebrow mb-4">
          <span className="size-1.5 shrink-0 rounded-full bg-ember-300" />
          <span className="min-w-0 truncate">{workspace.name}</span>
        </p>
      </Reveal>

      <Reveal level="balanced" delay={0.1}>
        <h1 className="text-glow font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          {getGreeting()}, {firstName}.
        </h1>
      </Reveal>

      <Reveal level="balanced" delay={0.2}>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <RoleBadge role={workspace.role} />
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-2">
            <Users size={13} strokeWidth={1.5} aria-hidden="true" />
            {members}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
            Created {formatDate(workspace.createdAt)}
          </span>
        </div>
      </Reveal>

      <p role="status" aria-live="polite" className="mt-6 min-h-5 text-[13px] text-success">
        {notice}
      </p>

      <div className="mt-4 space-y-6">
        <Reveal level="balanced" delay={0.3}>
          <QuickActions
            onCreateDocument={create}
            creatingDocument={creating}
            onCreateTask={openNewTask}
          />
          {createError && (
            <div className="mt-3">
              <FormAlert message={createError} />
            </div>
          )}
        </Reveal>

        <Reveal level="balanced" delay={0.4}>
          <GettingStarted
            recent={recentDocs}
            tasks={stats}
            onCreateDocument={create}
            creatingDocument={creating}
            onCreateTask={openNewTask}
          />
        </Reveal>

        <Reveal level="balanced" inView>
          <StatsRow stats={stats} />
        </Reveal>

        <div className="grid gap-4 md:grid-cols-2">
          <Reveal level="balanced" inView className="h-full">
            <AssignedCard assigned={assigned} onOpenTask={openTask} />
          </Reveal>
          <Reveal level="balanced" inView delay={0.08} className="h-full">
            <TeamCard />
          </Reveal>
          <Reveal level="balanced" inView className="h-full">
            <RecentDocumentsCard recent={recentDocs} onCreateDocument={create} creating={creating} />
          </Reveal>
          <Reveal level="balanced" inView delay={0.08} className="h-full">
            <RecentTasksCard recent={recentTasks} onOpenTask={openTask} onCreateTask={openNewTask} />
          </Reveal>
        </div>
      </div>

      {taskDialog && (
        <TaskDialogHost
          task={taskDialog.task}
          onSaved={(task, verb) => finish(`“${task.title}” was ${verb}.`)}
          onDeleted={(task) => finish(`“${task.title}” was deleted.`)}
          onGone={() => finish("That task was already deleted.")}
          onClose={() => setTaskDialog(null)}
        />
      )}
    </div>
  );
}