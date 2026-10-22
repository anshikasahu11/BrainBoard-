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
import RecentSnippetsCard from "@/components/dashboard/RecentSnippetsCard";
import TaskDialogHost from "@/components/dashboard/TaskDialogHost";
import SnippetDialogHost from "@/components/dashboard/SnippetDialogHost";
import useAuth from "@/hooks/useAuth";
import useCoalescedReload from "@/hooks/useCoalescedReload";
import useCreateDocument from "@/hooks/useCreateDocument";
import useLiveEvents from "@/hooks/useLiveEvents";
import useLoad from "@/hooks/useLoad";
import useRecentDocuments from "@/hooks/useRecentDocuments";
import useWorkspace from "@/hooks/useWorkspace";
import { listSnippetsRequest } from "@/services/snippetService";
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

  // The newest snippets. The list also reports the real total, which the checklist uses.
  const snippets = useLoad(`snippets-recent:${workspace.id}`, () =>
    listSnippetsRequest(workspace.id, { limit: 4 })
  );

  const [taskDialog, setTaskDialog] = useState(null); // {} to create, { task } to edit, or null
  const [snippetDialog, setSnippetDialog] = useState(null); // { mode: "form" }, { mode: "view", id }, or null
  const [notice, setNotice] = useState("");

  // Live: when a teammate changes a task, refresh the three task cards together
  // (one merged reload for a burst of events). Documents and snippets follow in the next step.
  const { reload: reloadStats } = stats;
  const { reload: reloadAssigned } = assigned;
  const { reload: reloadRecentTasks } = recentTasks;

  const liveTaskReload = useCoalescedReload(() => {
    reloadStats();
    reloadAssigned();
    reloadRecentTasks();
  });
  const isThis = (payload) => payload?.workspaceId === workspace.id;

  useLiveEvents({
    "task:created": (payload) => isThis(payload) && liveTaskReload(),
    "task:updated": (payload) => isThis(payload) && liveTaskReload(),
    "task:moved": (payload) => isThis(payload) && liveTaskReload(),
    "task:deleted": (payload) => isThis(payload) && liveTaskReload(),
    "tasks:refresh": (payload) => isThis(payload) && liveTaskReload(),
    // We were offline for a while, so events may have been missed.
    "connection:restored": () => liveTaskReload(),
  });

  function openNewTask() {
    setNotice("");
    setTaskDialog({});
  }

  function openTask(task) {
    setNotice("");
    setTaskDialog({ task });
  }

  function openNewSnippet() {
    setNotice("");
    setSnippetDialog({ mode: "form" });
  }

  function openSnippet(snippet) {
    setNotice("");
    setSnippetDialog({ mode: "view", id: snippet.id });
  }

  // After any task change, close the dialog and refresh all three task cards together.
  function finishTask(message) {
    setTaskDialog(null);
    setNotice(message);
    stats.reload();
    assigned.reload();
    recentTasks.reload();
  }

  // After any snippet change, close the dialog and refresh the snippets card (and checklist).
  function finishSnippet(message) {
    setSnippetDialog(null);
    setNotice(message);
    snippets.reload();
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
            onCreateSnippet={openNewSnippet}
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
            snippets={snippets}
            onCreateDocument={create}
            creatingDocument={creating}
            onCreateTask={openNewTask}
            onCreateSnippet={openNewSnippet}
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
          <Reveal level="balanced" inView className="h-full md:col-span-2">
            <RecentSnippetsCard
              recent={snippets}
              onOpen={openSnippet}
              onCreate={openNewSnippet}
            />
          </Reveal>
        </div>
      </div>

      {taskDialog && (
        <TaskDialogHost
          task={taskDialog.task}
          onSaved={(task, verb) => finishTask(`“${task.title}” was ${verb}.`)}
          onDeleted={(task) => finishTask(`“${task.title}” was deleted.`)}
          onGone={() => finishTask("That task was already deleted.")}
          onClose={() => setTaskDialog(null)}
        />
      )}

      {snippetDialog && (
        <SnippetDialogHost
          start={snippetDialog}
          onChanged={finishSnippet}
          onClose={() => setSnippetDialog(null)}
        />
      )}
    </div>
  );
}