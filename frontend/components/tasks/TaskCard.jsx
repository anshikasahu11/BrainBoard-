"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import PriorityBadge from "@/components/tasks/PriorityBadge";
import DueChip from "@/components/tasks/DueChip";

// The title and badges, shared by the real card and the floating copy.
function CardContent({ task }) {
  return (
    <>
      <span className="line-clamp-3 block break-words text-[14px] leading-snug">{task.title}</span>

      <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} />
        <DueChip dueDate={task.dueDate} status={task.status} />

        {task.assignee && (
          <span
            className="avatar avatar-sm ml-auto"
            role="img"
            aria-label={`Assigned to ${task.assignee.name}`}
            title={task.assignee.name}
          >
            {task.assignee.name.charAt(0).toUpperCase()}
          </span>
        )}
      </span>
    </>
  );
}

// The copy that floats under your pointer while you drag. Look only, no controls.
export function TaskCardPreview({ task }) {
  return (
    <div className="task-item task-item-overlay" aria-hidden="true">
      <span className="task-grip">
        <GripVertical size={14} strokeWidth={1.75} />
      </span>
      <div className="task-body">
        <CardContent task={task} />
      </div>
    </div>
  );
}

// One task on the board. You can grab the card anywhere with a mouse or a finger.
// For the keyboard there's a grip handle: focus it, press Space to pick the card
// up, use the arrow keys to move it, and press Space again to drop it.
export default function TaskCard({ task, onOpen, dragDisabled }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled: dragDisabled });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...listeners}
      className={`task-item ${isDragging ? "task-item-dragging" : ""}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        aria-roledescription="draggable task"
        aria-label={`Move ${task.title}`}
        className="task-grip"
      >
        <GripVertical size={14} strokeWidth={1.75} aria-hidden="true" />
      </button>

      <button type="button" onClick={() => onOpen(task)} className="task-body">
        <CardContent task={task} />
      </button>
    </li>
  );
}