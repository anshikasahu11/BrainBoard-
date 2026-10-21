"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import FormAlert from "@/components/auth/FormAlert";
import useWorkspace from "@/hooks/useWorkspace";
import { STATUSES } from "@/lib/tasks";

// stats: the useLoad result for the workspace's task counts.
export default function StatsRow({ stats }) {
  const { workspace } = useWorkspace();
  const data = stats.status === "ready" ? stats.data.stats : null;

  return (
    <section aria-label="Task statistics">
      {stats.status === "error" ? (
        <div className="max-w-md space-y-3">
          <FormAlert message={stats.error} />
          <button
            type="button"
            onClick={stats.retry}
            className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-busy={!data}>
            {STATUSES.map(({ value, label, icon: Icon, tone }) => (
              <div key={value} className="glass flex flex-col-reverse rounded-card p-4">
                <dt
                  className={`mt-1 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] ${tone}`}
                >
                  <Icon size={12} strokeWidth={1.75} aria-hidden="true" />
                  {label}
                </dt>
                <dd className="font-display text-4xl leading-none">
                  {data ? (
                    data[value]
                  ) : (
                    <>
                      <span className="skeleton inline-block h-9 w-10 rounded-chip" aria-hidden="true" />
                      <span className="sr-only">Loading</span>
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>

          {data && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
              {data.overdue > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-danger">
                  <AlertCircle size={13} strokeWidth={1.75} aria-hidden="true" />
                  {data.overdue} overdue
                </span>
              ) : (
                <span className="text-fg-muted">
                  {data.total === 0 ? "No tasks yet" : "Nothing overdue"}
                </span>
              )}
              <Link
                href={`/workspaces/${workspace.id}/tasks`}
                className="text-fg-2 underline underline-offset-4 transition-colors hover:text-ember-300"
              >
                Open board
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}