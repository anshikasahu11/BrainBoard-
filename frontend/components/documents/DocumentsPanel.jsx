"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Plus, Search, SearchX, X } from "lucide-react";
import PageHeading from "@/components/app/PageHeading";
import Reveal from "@/components/Reveal";
import FormAlert from "@/components/auth/FormAlert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { EmptyHint } from "@/components/dashboard/DashboardCard";
import DocumentRow from "@/components/documents/DocumentRow";
import useAuth from "@/hooks/useAuth";
import useCoalescedReload from "@/hooks/useCoalescedReload";
import useDebounce from "@/hooks/useDebounce";
import useLiveEvents from "@/hooks/useLiveEvents";
import usePresence from "@/hooks/usePresence";
import useWorkspace from "@/hooks/useWorkspace";
import {
  createDocumentRequest,
  deleteDocumentRequest,
  listDocumentsRequest,
} from "@/services/documentService";
import { canDeleteDocument } from "@/lib/permissions";

export default function DocumentsPanel() {
  const { workspace, role } = useWorkspace();
  const { user } = useAuth();
  const router = useRouter();
  const { editorsOf } = usePresence(workspace.id);

  const [query, setQuery] = useState("");
  const typedQuery = query.trim();
  const debouncedQuery = useDebounce(typedQuery, 300);

  // `query` inside state is the search these results belong to.
  const [state, setState] = useState({ status: "loading", documents: [], error: "", query: "" });
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState("");

  // True while a background (live) refresh is running: if it fails, the list stays.
  const quietRef = useRef(false);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Load (and reload on every new search). If a newer search starts, the older
  // one is cancelled, so a slow response can never overwrite a newer one.
  useEffect(() => {
    let cancelled = false;

    listDocumentsRequest(workspace.id, debouncedQuery)
      .then((data) => {
        if (cancelled) return;
        quietRef.current = false;
        setState({ status: "ready", documents: data.documents, error: "", query: debouncedQuery });
      })
      .catch((error) => {
        if (cancelled) return;
        setState((current) =>
          quietRef.current && current.status === "ready" && current.query === debouncedQuery
            ? current
            : { status: "error", documents: [], error: error.message, query: debouncedQuery }
        );
      });

    return () => {
      cancelled = true;
    };
  }, [workspace.id, debouncedQuery, attempt]);

  // Live: when a teammate creates, edits or deletes a document, refresh the list.
  // Autosave sends an event every couple of seconds while someone types, so a
  // burst is merged into one refresh. Your current search is kept.
  const liveReload = useCoalescedReload(() => {
    quietRef.current = true;
    setAttempt((n) => n + 1);
  }, false, 400);
  const isThis = (payload) => payload?.workspaceId === workspace.id;

  useLiveEvents({
    "document:created": (payload) => isThis(payload) && liveReload(),
    "document:updated": (payload) => isThis(payload) && liveReload(),
    "document:deleted": (payload) => isThis(payload) && liveReload(),
    // We were offline for a while, so events may have been missed.
    "connection:restored": () => liveReload(),
  });

  // The list on screen is out of date while you're typing or a search is loading.
  const refreshing = state.status === "ready" && state.query !== typedQuery;

  function retry() {
    quietRef.current = false;
    setState((current) => ({ ...current, status: "loading", error: "" }));
    setAttempt((n) => n + 1);
  }

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    setCreateError("");

    try {
      const { document: created } = await createDocumentRequest(workspace.id);
      // Go straight into the new document. "creating" stays on so the button
      // doesn't flicker during the navigation.
      router.push(`/workspaces/${workspace.id}/documents/${created.id}`);
    } catch (error) {
      setCreateError(error.message);
      setCreating(false);
    }
  }

  async function confirmDelete() {
    const doc = pendingDelete;
    setDeleting(true);
    setDeleteError("");

    const removeFromList = () =>
      setState((current) => ({
        ...current,
        documents: current.documents.filter((d) => d.id !== doc.id),
      }));

    try {
      await deleteDocumentRequest(workspace.id, doc.id);
      removeFromList();
      setNotice(`“${doc.title}” was deleted.`);
      setPendingDelete(null);
    } catch (error) {
      if (error.status === 404) {
        // Already gone (someone else deleted it). Just tidy the list.
        removeFromList();
        setPendingDelete(null);
      } else {
        setDeleteError(error.message);
      }
    } finally {
      setDeleting(false);
    }
  }

  // What screen readers hear when the results change.
  const count = state.documents.length;
  let summary = "";
  if (state.status === "ready" && !refreshing) {
    const capped = count >= 50 ? " (showing the latest 50)" : "";
    summary = state.query
      ? `${count} ${count === 1 ? "result" : "results"} for “${state.query}”${capped}`
      : `${count} ${count === 1 ? "document" : "documents"}${capped}`;
  }

  return (
    <div>
      <PageHeading
        eyebrow="Documents"
        title="Your documents"
        description="Notes, guides and specs your team writes together."
      />

      <Reveal level="balanced" delay={0.25} className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div role="search" className="relative flex-1">
            <label htmlFor="document-search" className="sr-only">
              Search documents
            </label>
            <Search
              size={16}
              strokeWidth={1.5}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted"
              aria-hidden="true"
            />
            <input
              id="document-search"
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setNotice("");
              }}
              placeholder="Search titles and text"
              autoComplete="off"
              className="input input-search"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-control text-fg-muted transition-colors hover:text-fg"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="btn-primary inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-control px-5 text-sm"
          >
            {creating ? (
              <Loader2 size={16} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
            ) : (
              <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
            )}
            {creating ? "Creating…" : "New document"}
          </button>
        </div>

        {createError && (
          <div className="mt-3">
            <FormAlert message={createError} />
          </div>
        )}
      </Reveal>

      <p
        role="status"
        aria-live="polite"
        className="mt-5 min-h-5 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted"
      >
        {notice || summary}
      </p>

      <div className="mt-3" aria-busy={state.status === "loading" || refreshing}>
        {state.status === "loading" && (
          <div className="space-y-3" role="status" aria-live="polite">
            <div className="skeleton h-[104px] rounded-card" />
            <div className="skeleton h-[104px] rounded-card" />
            <div className="skeleton h-[104px] rounded-card" />
            <span className="sr-only">Loading documents</span>
          </div>
        )}

        {/* Never show an empty list when the real problem is a failed request. */}
        {state.status === "error" && (
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
        )}

        {state.status === "ready" && count === 0 && !state.query && (
          <div className="glass max-w-xl rounded-card p-6">
            <EmptyHint icon={FileText} title="No documents yet">
              Write your first document: meeting notes, a spec, a how-to. Everyone in this
              workspace can read and edit it.
            </EmptyHint>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="btn-primary mt-5 inline-flex items-center gap-2 rounded-control px-4 py-2 text-sm"
            >
              <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              New document
            </button>
          </div>
        )}

        {state.status === "ready" && count === 0 && state.query && (
          <div className="glass max-w-xl rounded-card p-6">
            <EmptyHint icon={SearchX} title={`No documents match “${state.query}”`}>
              Try a different word, or check the spelling.
            </EmptyHint>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="btn-ghost mt-5 inline-flex items-center rounded-control px-4 py-2 text-sm"
            >
              Clear search
            </button>
          </div>
        )}

        {state.status === "ready" && count > 0 && (
          <ul className={`space-y-3 transition-opacity duration-200 ${refreshing ? "opacity-60" : ""}`}>
            {state.documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                href={`/workspaces/${workspace.id}/documents/${doc.id}`}
                editors={editorsOf(doc.id)}
                onDelete={
                  canDeleteDocument(role, doc, user.id)
                    ? (target) => {
                        setDeleteError("");
                        setPendingDelete(target);
                      }
                    : undefined
                }
              />
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this document?"
        description={
          pendingDelete ? `“${pendingDelete.title}” will be deleted for everyone. This can't be undone.` : ""
        }
        confirmLabel="Delete"
        loadingLabel="Deleting…"
        danger
        loading={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setPendingDelete(null)}
      />
    </div>
  );
}