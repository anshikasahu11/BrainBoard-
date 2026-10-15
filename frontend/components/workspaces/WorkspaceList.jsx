"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Reveal from "@/components/Reveal";
import FormAlert from "@/components/auth/FormAlert";
import WorkspaceCard from "@/components/workspaces/WorkspaceCard";
import { listWorkspacesRequest } from "@/services/workspaceService";
import { getLastWorkspace } from "@/lib/lastWorkspace";

export default function WorkspaceList() {
  const [state, setState] = useState({ status: "loading", workspaces: [], error: "" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    listWorkspacesRequest()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", workspaces: data.workspaces, error: "" });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", workspaces: [], error: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function retry() {
    setState({ status: "loading", workspaces: [], error: "" });
    setAttempt((n) => n + 1);
  }

  if (state.status === "loading") {
    return (
      <div className="grid gap-4 sm:grid-cols-2" role="status" aria-live="polite">
        <div className="skeleton h-[132px] rounded-card" />
        <div className="skeleton h-[132px] rounded-card" />
        <span className="sr-only">Loading your workspaces</span>
      </div>
    );
  }

  // Never show an empty list when the real problem is a failed request.
  if (state.status === "error") {
    return (
      <div className="max-w-md space-y-4">
        <FormAlert message={state.error} />
        <button
          type="button"
          onClick={retry}
          className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  if (state.workspaces.length === 0) {
    return (
      <div className="glass max-w-xl rounded-card p-6">
        <p className="text-[15px] font-medium">No workspaces yet</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-fg-2">
          Create your first one below to start organising documents, tasks and code with your team.
        </p>
      </div>
    );
  }

  // Offer to jump back to the workspace you used last (only worth it with 2+).
  const lastId = getLastWorkspace();
  const last = state.workspaces.length > 1 ? state.workspaces.find((w) => w.id === lastId) : null;

  return (
    <div className="space-y-6">
      {last && (
        <Link
          href={`/workspaces/${last.id}`}
          className="btn-primary inline-flex max-w-full items-center gap-2 rounded-control px-5 py-2.5 text-sm"
        >
          <span className="truncate">Continue to {last.name}</span>
          <ArrowRight size={15} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
        </Link>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {state.workspaces.map((workspace, index) => (
          <li key={workspace.id}>
            <Reveal level="balanced" delay={Math.min(index, 6) * 0.06} className="h-full">
              <WorkspaceCard workspace={workspace} />
            </Reveal>
          </li>
        ))}
      </ul>
    </div>
  );
}