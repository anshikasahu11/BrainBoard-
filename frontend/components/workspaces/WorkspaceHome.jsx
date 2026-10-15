"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import Reveal from "@/components/Reveal";
import FormAlert from "@/components/auth/FormAlert";
import RoleBadge from "@/components/workspaces/RoleBadge";
import { getWorkspaceRequest } from "@/services/workspaceService";
import { formatDate } from "@/lib/format";

// A temporary workspace page. Phase 4 replaces it with the real dashboard.
export default function WorkspaceHome() {
  const { workspaceId } = useParams();
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    getWorkspaceRequest(workspaceId)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", workspace: data.workspace });
      })
      .catch((error) => {
        if (cancelled) return;
        // 404 covers "doesn't exist", "deleted" and "not yours". Same screen for all.
        setState(
          error.status === 404
            ? { status: "notfound" }
            : { status: "error", message: error.message }
        );
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const back = (
    <Link
      href="/workspaces"
      className="mb-8 inline-flex items-center gap-2 text-[13px] text-fg-2 transition-colors hover:text-ember-300"
    >
      <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" />
      All workspaces
    </Link>
  );

  if (state.status === "loading") {
    return (
      <div role="status" aria-live="polite">
        {back}
        <div className="skeleton h-12 w-72 rounded-card" />
        <span className="sr-only">Loading workspace</span>
      </div>
    );
  }

  if (state.status === "notfound") {
    return (
      <div>
        {back}
        <Reveal level="balanced">
          <h1 className="text-glow font-display text-5xl leading-[1.05] tracking-tight">
            Workspace not found
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-fg-2">
            It may have been deleted, or you may not have access to it.
          </p>
        </Reveal>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="max-w-md">
        {back}
        <FormAlert message={state.message} />
      </div>
    );
  }

  const { workspace } = state;

  return (
    <div>
      {back}

      <Reveal level="balanced">
        <h1 className="text-glow font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          {workspace.name}
        </h1>
      </Reveal>

      <Reveal level="balanced" delay={0.1}>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <RoleBadge role={workspace.role} />
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-2">
            <Users size={13} strokeWidth={1.5} aria-hidden="true" />
            {workspace.memberCount} {workspace.memberCount === 1 ? "member" : "members"}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
            Created {formatDate(workspace.createdAt)}
          </span>
        </div>
      </Reveal>

      <Reveal level="balanced" delay={0.2} className="mt-10">
        <div className="glass max-w-xl rounded-card p-6">
          <p className="text-[15px] font-medium">Your dashboard is on its way</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-fg-2">
            Next we build the workspace shell, with a sidebar, a workspace switcher and the members
            page. After that come documents, tasks and code snippets.
          </p>
        </div>
      </Reveal>
    </div>
  );
}