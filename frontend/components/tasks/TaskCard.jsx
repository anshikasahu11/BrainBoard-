import PriorityBadge from "@/components/tasks/PriorityBadge";
import DueChip from "@/components/tasks/DueChip";

// One task on the board. The whole card is a button that opens the editor.
export default function TaskCard({ task, onOpen }) {
  return (
    <li>
      <button type="button" onClick={() => onOpen(task)} className="task-card">
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
      </button>
    </li>
  );
}