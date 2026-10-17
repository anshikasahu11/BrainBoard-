"use client";

import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import DashboardCard, { EmptyHint } from "@/components/dashboard/DashboardCard";
import FormAlert from "@/components/auth/FormAlert";
import useWorkspace from "@/hooks/useWorkspace";
import { formatRelative } from "@/lib/format";

// recent: the object from useRecentDocuments ({ status, documents, error, retry }).
export default function RecentDocumentsCard({ recent, onCreateDocument, creating }) {
  const { workspace } = useWorkspace();

  return (
    <DashboardCard
      title="Recent documents"
      action={{ href: `/workspaces/${workspace.id}/documents`, label: "View all" }}
    >
      {recent.status === "loading" && (
        <div className="space-y-3" role="status" aria-live="polite">
          <div className="skeleton h-10 rounded-control" />
          <div className="skeleton h-10 rounded-control" />
          <span className="sr-only">Loading recent documents</span>
        </div>
      )}

      {/* Never show "no documents" when the real problem is a failed request. */}
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

      {recent.status === "ready" && recent.documents.length === 0 && (
        <div className="space-y-4">
          <EmptyHint icon={FileText} title="No documents yet">
            Write notes, specs and guides your whole team can edit.
          </EmptyHint>
          <button
            type="button"
            onClick={onCreateDocument}
            disabled={creating}
            className="btn-ghost inline-flex items-center gap-2 rounded-control px-4 py-2 text-sm"
          >
            <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
            {creating ? "Creating…" : "New document"}
          </button>
        </div>
      )}

      {recent.status === "ready" && recent.documents.length > 0 && (
        <ul>
          {recent.documents.map((doc) => (
            <li key={doc.id} className="border-t border-line first:border-t-0">
              <Link
                href={`/workspaces/${workspace.id}/documents/${doc.id}`}
                className="-mx-2 block rounded-control px-2 py-2.5 transition-colors hover:bg-white/5"
              >
                <span className="block truncate text-[14px]">{doc.title}</span>
                <span className="mt-0.5 block truncate font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
                  Edited {formatRelative(doc.updatedAt)} · {doc.lastEditedBy.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}