import { Plus } from "lucide-react";
import TaskCard from "@/components/tasks/TaskCard";
import { statusInfo } from "@/lib/tasks";

export default function BoardColumn({ status, tasks, onAdd, onOpen }) {
  const info = statusInfo(status);
  const Icon = info.icon;
  const headingId = `column-${status}`;

  return (
    <section aria-labelledby={headingId} className="board-column">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2
          id={headingId}
          className={`flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] ${info.tone}`}
        >
          <Icon size={13} strokeWidth={1.75} aria-hidden="true" />
          {info.label}
          <span className="text-fg-muted">
            <span className="sr-only">, </span>
            {tasks.length}
            <span className="sr-only"> tasks</span>
          </span>
        </h2>

        <button
          type="button"
          onClick={() => onAdd(status)}
          aria-label={`Add a task to ${info.label}`}
          className="grid size-7 place-items-center rounded-control text-fg-muted transition-colors hover:bg-white/10 hover:text-fg"
        >
          <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      {tasks.length === 0 ? (
        <p className="column-empty">No tasks</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </section>
  );
}