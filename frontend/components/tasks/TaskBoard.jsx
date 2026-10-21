"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useReducedMotion } from "motion/react";
import { ListChecks, Plus } from "lucide-react";
import PageHeading from "@/components/app/PageHeading";
import Reveal from "@/components/Reveal";
import FormAlert from "@/components/auth/FormAlert";
import { EmptyHint } from "@/components/dashboard/DashboardCard";
import BoardColumn from "@/components/tasks/BoardColumn";
import { TaskCardPreview } from "@/components/tasks/TaskCard";
import TaskDialog from "@/components/tasks/TaskDialog";
import TaskFilters from "@/components/tasks/TaskFilters";
import useAuth from "@/hooks/useAuth";
import useDebounce from "@/hooks/useDebounce";
import useMembers from "@/hooks/useMembers";
import useTasks from "@/hooks/useTasks";
import useWorkspace from "@/hooks/useWorkspace";
import { moveTaskRequest } from "@/services/taskService";
import { STATUSES, statusInfo } from "@/lib/tasks";
import {
  applyGroups,
  findColumn,
  groupIds,
  isColumnId,
  moveOver,
  placementOf,
  samePlacement,
  statusFromColumnId,
} from "@/lib/boardDnd";

// Read aloud to screen-reader users when they focus a card's grip handle.
const SCREEN_READER_INSTRUCTIONS = {
  draggable:
    "To move this task, press Space or Enter, use the arrow keys to move it, then press Space or Enter to drop it. Press Escape to cancel.",
};

export default function TaskBoard() {
  const { workspace, role } = useWorkspace();
  const { user } = useAuth();
  const people = useMembers(workspace.id);
  const reduceMotion = useReducedMotion();

  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("");
  const [assignee, setAssignee] = useState("");
  const typedQuery = query.trim();
  const debouncedQuery = useDebounce(typedQuery, 300);

  const board = useTasks(workspace.id, { q: debouncedQuery, priority, assignee });

  const [dialog, setDialog] = useState(null); // { task } to edit, { status } to create, or null
  const [notice, setNotice] = useState("");

  // Drag state. While a card is being dragged, the board draws from `drag.groups`
  // (the live arrangement) instead of the saved tasks. The ref mirrors it, so event
  // handlers always read the newest value.
  const [drag, setDrag] = useState(null); // { activeId, groups, startGroups } | null
  const dragRef = useRef(null);
  const [moving, setMoving] = useState(false); // a move is being saved
  const [moveError, setMoveError] = useState("");

  const sensors = useSensors(
    // A click still opens the card: dragging needs 6px of movement.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // On touch: press and hold briefly to drag, otherwise the board just scrolls.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const filtersActive = Boolean(typedQuery || priority || assignee);
  const dragDisabled = moving || board.refreshing;

  const taskById = useMemo(() => new Map(board.tasks.map((task) => [task.id, task])), [board.tasks]);

  const columns = useMemo(() => {
    if (drag) {
      return STATUSES.map((status) => ({
        ...status,
        tasks: drag.groups[status.value].map((id) => taskById.get(id)).filter(Boolean),
      }));
    }
    // The server already sorted the cards by position.
    return STATUSES.map((status) => ({
      ...status,
      tasks: board.tasks.filter((task) => task.status === status.value),
    }));
  }, [drag, board.tasks, taskById]);

  const draggedTask = drag ? taskById.get(drag.activeId) : null;
  const activeColumn = drag ? findColumn(drag.groups, drag.activeId) : null;

  function updateDrag(next) {
    dragRef.current = next;
    setDrag(next);
  }

  // Decides which card or column the dragged card is "over".
  // Cards win over columns, and a gap between cards picks the nearest card in that
  // column, so dropping in a gap never throws the card to the bottom.
  const collisionStrategy = useCallback((args) => {
    const groups = dragRef.current?.groups;
    const columnIsEmpty = (id) =>
      isColumnId(id) && (groups?.[statusFromColumnId(id)]?.length ?? 0) === 0;

    const hits = pointerWithin(args);
    if (hits.length > 0) {
      const card = hits.find((hit) => !isColumnId(hit.id));
      if (card) return [card];

      const column = hits.find((hit) => isColumnId(hit.id));
      if (column) {
        const ids = new Set(groups?.[statusFromColumnId(column.id)] ?? []);
        const candidates = args.droppableContainers.filter((c) => ids.has(c.id));
        if (candidates.length > 0) return closestCenter({ ...args, droppableContainers: candidates });
        return [column]; // an empty column
      }
    }

    // Keyboard (no pointer), or the pointer is outside every column:
    // the nearest card, or an empty column.
    const targets = args.droppableContainers.filter((c) => !isColumnId(c.id) || columnIsEmpty(c.id));
    return closestCorners({ ...args, droppableContainers: targets });
  }, []);

  // What screen readers hear while dragging: titles and column names, never ids.
  const announcements = useMemo(() => {
    const titleOf = (id) => taskById.get(id)?.title ?? "task";
    const labelOf = (id) => {
      const groups = dragRef.current?.groups;
      const status = groups ? findColumn(groups, id) : null;
      return statusInfo(status ?? "todo").label;
    };

    return {
      onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}.`,
      onDragOver: ({ active, over }) => {
        if (!over) return undefined;
        const target = isColumnId(over.id)
          ? `the ${labelOf(over.id)} column`
          : `${titleOf(over.id)} in ${labelOf(over.id)}`;
        return `${titleOf(active.id)} is over ${target}.`;
      },
      onDragEnd: ({ active, over }) =>
        over ? `Dropped ${titleOf(active.id)}.` : `Dropped ${titleOf(active.id)} outside the board. Nothing changed.`,
      onDragCancel: ({ active }) => `Cancelled. ${titleOf(active.id)} was not moved.`,
    };
  }, [taskById]);

  function handleDragStart({ active }) {
    setMoveError("");
    setNotice("");
    const groups = groupIds(board.tasks);
    updateDrag({ activeId: active.id, groups, startGroups: groups });
  }

  // While dragging: moving between columns happens live, so the cards make room.
  function handleDragOver({ active, over }) {
    const current = dragRef.current;
    if (!current || !over) return;

    const translated = active.rect.current.translated;
    const isBelow = Boolean(
      translated &&
        !isColumnId(over.id) &&
        translated.top + translated.height / 2 > over.rect.top + over.rect.height / 2
    );

    const groups = moveOver(current.groups, active.id, over.id, isBelow);
    if (groups !== current.groups) updateDrag({ ...current, groups });
  }

  async function handleDragEnd({ active, over }) {
    const current = dragRef.current;
    if (!current) return;

    // Dropped outside every column: cancel, and the card goes back.
    if (!over) {
      updateDrag(null);
      return;
    }

    // Reordering inside one column is settled here (moving between columns
    // already happened live).
    let groups = current.groups;
    const column = findColumn(groups, active.id);
    if (column && findColumn(groups, over.id) === column) {
      const list = groups[column];
      const oldIndex = list.indexOf(active.id);
      const newIndex = isColumnId(over.id) ? list.length - 1 : list.indexOf(over.id);
      if (newIndex >= 0 && oldIndex !== newIndex) {
        groups = { ...groups, [column]: arrayMove(list, oldIndex, newIndex) };
      }
    }

    const before = placementOf(current.startGroups, active.id);
    const after = placementOf(groups, active.id);

    // Dropped back where it started: nothing to save.
    if (!after || samePlacement(before, after)) {
      updateDrag(null);
      return;
    }

    // Show the new arrangement at once, then save it in the background.
    const snapshot = board.tasks;
    board.setTasks(applyGroups(snapshot, groups));
    updateDrag(null);
    setMoving(true);

    try {
      const { task: saved } = await moveTaskRequest(workspace.id, active.id, {
        status: after.status,
        afterId: after.afterId,
      });

      board.setTasks((list) => list.map((task) => (task.id === saved.id ? saved : task)));
      const label = statusInfo(saved.status).label;
      setNotice(
        before.status === after.status
          ? `Reordered “${saved.title}” in ${label}.`
          : `Moved “${saved.title}” to ${label}.`
      );
    } catch (error) {
      if (error.status === 400 || error.status === 404) {
        // A teammate changed the board (moved or deleted a task) while you were
        // dragging. The server is right, so reload from it.
        setMoveError(
          "The board changed while you were dragging, so it was refreshed. Try that move again."
        );
        board.reload();
      } else {
        // Couldn't save (offline, server trouble): put the card back.
        board.setTasks(snapshot);
        setMoveError(error.message);
      }
    } finally {
      setMoving(false);
    }
  }

  function handleDragCancel() {
    updateDrag(null);
  }

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
        description="Plan work, assign it, and drag it from to do to done."
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

      {moveError && (
        <div className="mt-3 max-w-xl">
          <FormAlert message={moveError} />
        </div>
      )}

      <div className="mt-3" aria-busy={board.status === "loading" || board.refreshing || moving}>
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
              Create the first one, then drag it across the board as work progresses. Everyone in
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
          <DndContext
            id="task-board"
            sensors={sensors}
            collisionDetection={collisionStrategy}
            accessibility={{
              announcements,
              screenReaderInstructions: SCREEN_READER_INSTRUCTIONS,
            }}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
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
                  highlighted={activeColumn === column.value}
                  dragDisabled={dragDisabled}
                  onAdd={(status) => setDialog({ status })}
                  onOpen={(task) => setDialog({ task })}
                />
              ))}
            </div>

            {/* The floating copy. No drop animation for people who prefer less motion. */}
            <DragOverlay dropAnimation={reduceMotion ? null : undefined}>
              {draggedTask ? <TaskCardPreview task={draggedTask} /> : null}
            </DragOverlay>
          </DndContext>
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