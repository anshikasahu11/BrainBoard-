"use client";

import { FileCode, Plus } from "lucide-react";
import DashboardCard, { EmptyHint } from "@/components/dashboard/DashboardCard";
import FormAlert from "@/components/auth/FormAlert";
import CopyButton from "@/components/snippets/CopyButton";
import useWorkspace from "@/hooks/useWorkspace";
import { getSnippetRequest } from "@/services/snippetService";
import { languageInfo } from "@/lib/snippets";
import { formatRelative } from "@/lib/format";

const SHOW = 4;

// recent: the useLoad result for the newest snippets (data: { snippets, total }).
// The server already sorted it, newest first.
export default function RecentSnippetsCard({ recent, onOpen, onCreate }) {
  const { workspace } = useWorkspace();

  const snippets = recent.status === "ready" ? recent.data.snippets.slice(0, SHOW) : [];
  const total = recent.status === "ready" ? recent.data.total : 0;
  const extra = total - snippets.length;

  return (
    <DashboardCard
      title="Recent snippets"
      action={{ href: `/workspaces/${workspace.id}/snippets`, label: "View all" }}
    >
      {recent.status === "loading" && (
        <div className="space-y-3" role="status" aria-live="polite">
          <div className="skeleton h-12 rounded-control" />
          <div className="skeleton h-12 rounded-control" />
          <span className="sr-only">Loading recent snippets</span>
        </div>
      )}

      {/* Never show "no snippets" when the real problem is a failed request. */}
      {recent.status === "error" && (
        <div className="space-y-3">
          <FormAlert message={recent.error} />
          <button
            type="button"
            onClick={recent.retry}
            className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
          >
            Try again
          </button>
        </div>
      )}

      {recent.status === "ready" && snippets.length === 0 && (
        <div className="space-y-4">
          <EmptyHint icon={FileCode} title="No snippets yet">
            Save the queries, configs and helpers your team reaches for again and again.
          </EmptyHint>
          <button
            type="button"
            onClick={onCreate}
            className="btn-ghost inline-flex items-center gap-2 rounded-control px-4 py-2 text-sm"
          >
            <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
            New snippet
          </button>
        </div>
      )}

      {recent.status === "ready" && snippets.length > 0 && (
        <>
          <ul>
            {snippets.map((snippet) => {
              const language = languageInfo(snippet.language);
              const lines = `${snippet.lineCount} ${snippet.lineCount === 1 ? "line" : "lines"}`;

              return (
                <li
                  key={snippet.id}
                  className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0"
                >
                  <button
                    type="button"
                    onClick={() => onOpen(snippet)}
                    className="-mx-2 min-w-0 flex-1 rounded-control px-2 py-1.5 text-left transition-colors hover:bg-white/5"
                  >
                    <span className="block truncate text-[14px]">{snippet.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="language-chip">{language.label}</span>
                      <span className="text-[12px] text-fg-muted">
                        {lines} · Edited {formatRelative(snippet.updatedAt)} · {snippet.lastEditedBy.name}
                      </span>
                    </span>
                  </button>

                  <CopyButton
                    subject={snippet.title}
                    className="shrink-0"
                    // The list only has a preview, so fetch the full code at the moment of the click.
                    getText={() =>
                      getSnippetRequest(workspace.id, snippet.id).then((data) => data.snippet.code)
                    }
                  />
                </li>
              );
            })}
          </ul>

          {extra > 0 && <p className="mt-3 text-[12px] text-fg-muted">+{extra} more in Snippets</p>}
        </>
      )}
    </DashboardCard>
  );
}