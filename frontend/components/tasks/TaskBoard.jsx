"use client";

import { useMemo, useState } from "react";
import { ListChecks, Plus } from "lucide-react";
import PageHeading from "@/components/app/PageHeading";
import Reveal from "@/components/Reveal";
import FormAlert from "@/components/auth/FormAlert";
import { EmptyHint } from "@/components/dashboard/DashboardCard";
import BoardColumn from "@/components/tasks/BoardColumn";
import TaskDialog from "@/components/tasks/TaskDialog";
import TaskFilters from "@/components/tasks/TaskFilters";
import useAuth from "@/hooks/useAuth";
import useDebounce from "@/hooks/useDebounce";
import useMembers from "@/hooks/useMembers";
import useTasks from "@/hooks/useTasks";
import useWorkspace from "@/hooks/useWorkspace";
import { STATUSES } from "@/lib/tasks";

export default function TaskBoard() {
  const { workspace, role } = useWorkspace();
  const { user } = useAuth();
  const people = useMembers(workspace.id);

  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("");
  const [assignee, setAssignee] = useState("");
  const typedQuery = query.trim();
  const debouncedQuery = useDebounce(typedQuery, 300);

  const board = useTasks(workspace.id, { q: debouncedQuery, priority, assignee });

  const [dialog, setDialog] = useState(null); // { task } to edit, { status } to create, or null
  const [notice, setNotice] = useState("");

  const filtersActive = Boolean(typedQuery || priority || assignee);

  // Group the cards into columns. The server already sorted them by position.
  const columns = useMemo(
    () =>
      STATUSES.map((status) => ({
        ...status,
        tasks: board.tasks.filter((task) => task.status === status.value),
      })),
    [board.tasks]
  );

  function clearFilters() {
    setQuery("");
    setPriority("");
    setAssignee("");
  }

  function handleSaved(task, verb) {
    setDialog(null);
    setNotice(`“${task.title}” was ${verb}.`);
    board.reload();
  }

  function handleDeleted(task) {
    setDialog(null);
    setNotice(`“${task.title}” was deleted.`);
    board.reload();
  }

  function handleGone() {
    setDialog(null);
    setNotice("That task was already deleted.");
    board.reload();
  }

  // What screen readers hear when the board changes.
  let summary = "";
  if (board.status === "ready" && !board.refreshing) {
    const count = board.tasks.length;
    const noun = count === 1 ? "task" : "tasks";
    summary = filtersActive ? `${count} ${noun} match` : `${count} ${noun}`;
    if (board.total > count) summary += ` (showing the first ${count} of ${board.total})`;
  }

  const noTasksAtAll = board.status === "ready" && board.tasks.length === 0 && !filtersActive;

  return (
    <div>
      <PageHeading
        eyebrow="Tasks"
        title="Your board"
        description="Plan work, assign it, and move it from to do to done."
      />

      <Reveal level="subtle" className="mt-8">
        <div className="flex flex-wrap items-center gap-3">
          <TaskFilters
            query={query}
            onQuery={(value) => {
              setQuery(value);
              setNotice("");
            }}
            priority={priority}
            onPriority={setPriority}
            assignee={assignee}
            onAssignee={setAssignee}
            members={people.members}
            currentUserId={user.id}
            active={filtersActive}
            onClear={clearFilters}
          />

          <button
            type="button"
            onClick={() => setDialog({ status: "todo" })}
            className="btn-primary inline-flex h-11 shrink-0 items-center gap-2 rounded-control px-5 text-sm"
          >
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
            New task
          </button>
        </div>
      </Reveal>

      <p
        role="status"
        aria-live="polite"
        className="mt-5 min-h-5 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted"
      >
        {notice || summary}
      </p>

      <div className="mt-3" aria-busy={board.status === "loading" || board.refreshing}>
        {board.status === "loading" && (
          <div className="board-grid" role="status" aria-live="polite">
            {STATUSES.map((status) => (
              <div key={status.value} className="board-column">
                <div className="skeleton mb-3 h-5 w-24 rounded-chip" />
                <div className="space-y-2">
                  <div className="skeleton h-[76px] rounded-card" />
                  <div className="skeleton h-[76px] rounded-card" />
                </div>
              </div>
            ))}
            <span className="sr-only">Loading tasks</span>
          </div>
        )}

        {/* Never show an empty board when the real problem is a failed request. */}
        {board.status === "error" && (
          <div className="max-w-md space-y-4">
            <FormAlert message={board.error} />
            <button
              type="button"
              onClick={board.retry}
              className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
            >
              Try again
            </button>
          </div>
        )}

        {noTasksAtAll && (
          <div className="glass mb-5 max-w-xl rounded-card p-6">
            <EmptyHint icon={ListChecks} title="No tasks yet">
              Create the first one, then move it across the board as work progresses. Everyone in
              this workspace can see and edit it.
            </EmptyHint>
            <button
              type="button"
              onClick={() => setDialog({ status: "todo" })}
              className="btn-primary mt-5 inline-flex items-center gap-2 rounded-control px-4 py-2 text-sm"
            >
              <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              New task
            </button>
          </div>
        )}

        {board.status === "ready" && (
          <div
            role="region"
            aria-label="Task board"
            tabIndex={0}
            className={`board-grid transition-opacity duration-200 ${
              board.refreshing ? "opacity-60" : ""
            }`}
          >
            {columns.map((column) => (
              <BoardColumn
                key={column.value}
                status={column.value}
                tasks={column.tasks}
                onAdd={(status) => setDialog({ status })}
                onOpen={(task) => setDialog({ task })}
              />
            ))}
          </div>
        )}
      </div>

      {dialog && (
        <TaskDialog
          key={dialog.task?.id ?? `new-${dialog.status}`}
          task={dialog.task}
          defaultStatus={dialog.status}
          workspaceId={workspace.id}
          members={people.members}
          role={role}
          userId={user.id}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onGone={handleGone}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}