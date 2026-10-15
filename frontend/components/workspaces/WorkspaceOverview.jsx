"use client";

import { Users } from "lucide-react";
import Reveal from "@/components/Reveal";
import RoleBadge from "@/components/workspaces/RoleBadge";
import useWorkspace from "@/hooks/useWorkspace";
import { formatDate } from "@/lib/format";

// A placeholder overview. Phase 4 replaces it with the real dashboard.
export default function WorkspaceOverview() {
  const { workspace } = useWorkspace();
  const members = `${workspace.memberCount} ${workspace.memberCount === 1 ? "member" : "members"}`;

  return (
    <div>
      <Reveal level="balanced">
        <p className="eyebrow mb-4">
          <span className="size-1.5 rounded-full bg-ember-300" />
          Overview
        </p>
      </Reveal>

      <Reveal level="balanced" delay={0.1}>
        <h1 className="text-glow font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          {workspace.name}
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

      <Reveal level="balanced" delay={0.3} className="mt-10">
        <div className="glass max-w-xl rounded-card p-6">
          <p className="text-[15px] font-medium">Your dashboard is on its way</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-fg-2">
            Documents, tasks and code snippets will appear here as soon as they&apos;re built.
          </p>
        </div>
      </Reveal>
    </div>
  );
}