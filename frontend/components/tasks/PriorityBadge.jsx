import { priorityInfo } from "@/lib/tasks";

export default function PriorityBadge({ priority }) {
  const info = priorityInfo(priority);
  const Icon = info.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-chip px-1.5 py-0.5 text-[11px] ${info.classes}`}
    >
      <Icon size={11} strokeWidth={2} aria-hidden="true" />
      {info.label}
    </span>
  );
}