"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle } from "lucide-react";

// Shown INSIDE the workspace (your sidebar stays) when one page crashes, so a bug on one page
// doesn't throw you out of the whole app.
export default function WorkspaceError({ error, reset }) {
  const { workspaceId } = useParams();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="glass max-w-xl rounded-card p-6">
      <div className="flex items-start gap-4">
        <AlertCircle size={22} strokeWidth={1.5} className="mt-1 shrink-0 text-danger" aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="font-display text-3xl leading-[1.1]">This page hit a problem</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-fg-2">
            Something unexpected broke here. Everything you’d saved is still saved, and the rest of the workspace
            works as normal.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="btn-primary inline-flex items-center rounded-control px-4 py-2 text-sm"
            >
              Try again
            </button>
            <Link
              href={`/workspaces/${encodeURIComponent(String(workspaceId ?? ""))}`}
              className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
            >
              Back to the overview
            </Link>
          </div>

          {error?.digest && (
            <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
              Reference: {error.digest}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}