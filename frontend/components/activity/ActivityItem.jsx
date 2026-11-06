"use client";

import Link from "next/link";
import { Code, FileText, History, Kanban, Settings, Users } from "lucide-react";
import { categoryLabel, describeActivity } from "@/lib/activityText";
import { formatDateTime, formatTime } from "@/lib/format";

// The icon follows the kind of thing. The category word beside it says the same in
// words, so the icon is never the only signal.
const ICONS = {
  workspace: Settings,
  member: Users,
  document: FileText,
  version: History,
  task: Kanban,
  snippet: Code,
};
const iconFor = (action) => ICONS[action.split(".")[0]] ?? FileText;

function Sentence({ segments }) {
  return segments.map((segment, index) => {
    if (segment.href) {
      return (
        <Link key={index} href={segment.href} className="activity-link">
          {segment.text}
        </Link>
      );
    }
    if (segment.strong) {
      return (
        <strong key={index} className="font-medium text-fg">
          {segment.text}
        </strong>
      );
    }
    return <span key={index}>{segment.text}</span>;
  });
}

// One line of history. `fresh` entries (they just arrived live) fade in once.
export default function ActivityItem({ activity, workspaceId, userId }) {
  const segments = describeActivity(activity, { workspaceId, userId });
  const Icon = iconFor(activity.action);

  return (
    <li className={`activity-item ${activity.fresh ? "activity-fresh" : ""}`}>
      <span className="avatar" aria-hidden="true">
        {activity.actor.name.charAt(0).toUpperCase()}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[14px] leading-relaxed text-fg-2">
          <Sentence segments={segments} />
        </p>
        <p className="mt-1 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
          <Icon size={12} strokeWidth={1.75} aria-hidden="true" />
          {categoryLabel(activity.category)}
          <span aria-hidden="true">·</span>
          <time dateTime={activity.createdAt} title={formatDateTime(activity.createdAt)}>
            {formatTime(activity.createdAt)}
          </time>
        </p>
      </div>
    </li>
  );
}