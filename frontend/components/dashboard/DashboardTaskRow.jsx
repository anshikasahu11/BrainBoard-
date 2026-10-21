import PriorityBadge from "@/components/tasks/PriorityBadge";
import DueChip from "@/components/tasks/DueChip";
import { statusInfo } from "@/lib/tasks";

// One task in a dashboard card. Clicking it opens the edit dialog.
// detail: an optional extra line of small text, for example "Updated 5 minutes ago".
export default function DashboardTaskRow({ task, onOpen, detail }) {
  const status = statusInfo(task.status);
  const StatusIcon = status.icon;

  return (
    <li className="border-t border-line first:border-t-0">
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="-mx-2 block w-[calc(100%+1rem)] rounded-control px-2 py-2.5 text-left transition-colors hover:bg-white/5"
      >
        <span className="block truncate text-[14px]">{task.title}</span>

        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={`inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.08em] ${status.tone}`}
          >
            <StatusIcon size={12} strokeWidth={1.75} aria-hidden="true" />
            {status.label}
          </span>
          <PriorityBadge priority={task.priority} />
          <DueChip dueDate={task.dueDate} status={task.status} />
          {detail && <span className="text-[12px] text-fg-muted">{detail}</span>}
        </span>
      </button>
    </li>
  );
}