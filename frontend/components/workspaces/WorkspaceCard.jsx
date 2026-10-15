import Link from "next/link";
import { ArrowUpRight, Users } from "lucide-react";
import RoleBadge from "@/components/workspaces/RoleBadge";
import { formatDate } from "@/lib/format";

export default function WorkspaceCard({ workspace }) {
  const members = `${workspace.memberCount} ${workspace.memberCount === 1 ? "member" : "members"}`;

  return (
    <Link
      href={`/workspaces/${workspace.id}`}
      className="glass feature-card group block h-full rounded-card p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate text-[16px] font-medium">{workspace.name}</h3>
        <ArrowUpRight
          size={16}
          strokeWidth={1.5}
          className="shrink-0 text-fg-muted transition-colors group-hover:text-ember-300"
          aria-hidden="true"
        />
      </div>

      <div className="mt-3">
        <RoleBadge role={workspace.role} />
      </div>

      <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
        <Users size={13} strokeWidth={1.5} aria-hidden="true" />
        {members}
        <span aria-hidden="true">·</span>
        Created {formatDate(workspace.createdAt)}
      </p>
    </Link>
  );
}