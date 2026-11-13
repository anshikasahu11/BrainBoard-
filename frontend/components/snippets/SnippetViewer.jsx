"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Sparkles, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import FormAlert from "@/components/auth/FormAlert";
import SnippetAi from "@/components/ai/SnippetAi";
import CodeBlock from "@/components/snippets/CodeBlock";
import CopyButton from "@/components/snippets/CopyButton";
import { canDeleteSnippet } from "@/lib/permissions";
import { languageInfo } from "@/lib/snippets";
import { formatDate, formatRelative } from "@/lib/format";
import { deleteSnippetRequest, getSnippetRequest } from "@/services/snippetService";

const TABS = [
  { value: "code", label: "Code", ai: false },
  { value: "explain", label: "Explain", ai: true },
  { value: "improve", label: "Improve", ai: true },
];

// Opens one snippet with its FULL code. Mount it only while it's open.
//   onEdit(snippet, extra): opens the edit form. extra.suggestedCode is code to fill in for review.
export default function SnippetViewer({
  snippetId,
  workspaceId,
  role,
  userId,
  onEdit,
  onDeleted,
  onGone,
  onClose,
}) {
  const [state, setState] = useState({ status: "loading" });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Which tab is showing. The AI tabs only load the first time they're opened (so browsing
  // snippets makes no extra requests), and then stay, so an answer survives switching tabs.
  const [tab, setTab] = useState("code");
  const [opened, setOpened] = useState({ explain: false, improve: false });

  function chooseTab(next) {
    setTab(next);
    if (next !== "code") setOpened((current) => ({ ...current, [next]: true }));
  }

  useEffect(() => {
    let cancelled = false;

    getSnippetRequest(workspaceId, snippetId)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", snippet: data.snippet });
      })
      .catch((err) => {
        if (cancelled) return;
        // 404 covers "deleted" and "never existed in this workspace".
        setState(err.status === 404 ? { status: "notfound" } : { status: "error", message: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, snippetId]);

  async function handleDelete() {
    setBusy(true);
    setError("");

    try {
      await deleteSnippetRequest(workspaceId, snippetId);
      onDeleted(state.snippet);
    } catch (err) {
      if (err.status === 404) {
        onGone();
        return;
      }
      setError(err.message);
      setBusy(false);
    }
  }

  const snippet = state.status === "ready" ? state.snippet : null;
  const language = snippet ? languageInfo(snippet.language) : null;

  return (
    <Modal title={snippet?.title ?? "Snippet"} onClose={onClose} busy={busy} size="lg">
      {state.status === "loading" && (
        <div role="status" aria-live="polite">
          <div className="skeleton h-48 rounded-card" />
          <span className="sr-only">Loading snippet</span>
        </div>
      )}

      {state.status === "notfound" && (
        <div className="space-y-4">
          <p className="text-[15px] leading-relaxed text-fg-2">
            This snippet no longer exists. It may have been deleted.
          </p>
          <button
            type="button"
            onClick={onGone}
            className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
          >
            Close
          </button>
        </div>
      )}

      {state.status === "error" && (
        <div className="space-y-4">
          <FormAlert message={state.message} />
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
          >
            Close
          </button>
        </div>
      )}

      {snippet && (
        <div className="space-y-4">
          <FormAlert message={error} />

          <div className="flex flex-wrap items-center gap-2">
            <span className="language-chip">{language.label}</span>
            {snippet.tags.map((tag) => (
              <span key={tag} className="tag-chip">
                {tag}
              </span>
            ))}
          </div>

          {snippet.description && (
            <p className="whitespace-pre-line text-[14px] leading-relaxed text-fg-2">
              {snippet.description}
            </p>
          )}

          <div className="seg" role="group" aria-label="What to show">
            {TABS.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={tab === item.value}
                onClick={() => chooseTab(item.value)}
                className={`seg-btn inline-flex items-center gap-1.5 ${tab === item.value ? "seg-btn-active" : ""}`}
              >
                {item.ai && <Sparkles size={12} strokeWidth={1.75} aria-hidden="true" />}
                {item.label}
              </button>
            ))}
          </div>

          <div hidden={tab !== "code"}>
            <CodeBlock
              code={snippet.code}
              language={snippet.language}
              label={`Code of ${snippet.title}`}
              scrollable
              className="code-block-full"
            />
          </div>

          {opened.explain && (
            <div hidden={tab !== "explain"}>
              <SnippetAi workspaceId={workspaceId} snippet={snippet} mode="explain" />
            </div>
          )}
          {opened.improve && (
            <div hidden={tab !== "improve"}>
              <SnippetAi
                workspaceId={workspaceId}
                snippet={snippet}
                mode="improve"
                onUseCode={(code) => onEdit(snippet, { suggestedCode: code })}
              />
            </div>
          )}

          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
            {snippet.lineCount} {snippet.lineCount === 1 ? "line" : "lines"} · Created by{" "}
            {snippet.createdBy.name}, {formatDate(snippet.createdAt)} · Edited{" "}
            {formatRelative(snippet.updatedAt)} by {snippet.lastEditedBy.name}
          </p>

          {confirming ? (
            <div className="rounded-card border border-danger/40 bg-scorched/60 p-4">
              <p className="text-[14px]">Delete this snippet for everyone?</p>
              <p className="mt-1 text-[13px] text-fg-2">This can&apos;t be undone.</p>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={busy}
                  className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="btn-danger inline-flex items-center gap-2 rounded-control px-4 py-2 text-sm"
                >
                  {busy && (
                    <Loader2 size={15} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
                  )}
                  {busy ? "Deleting…" : "Delete snippet"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div>
                {canDeleteSnippet(role, snippet, userId) && (
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className="inline-flex items-center gap-2 rounded-control px-3 py-2 text-[13px] text-fg-2 transition-colors hover:bg-white/10 hover:text-danger"
                  >
                    <Trash2 size={15} strokeWidth={1.5} aria-hidden="true" />
                    Delete
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <CopyButton subject={snippet.title} getText={() => snippet.code} />
                <button
                  type="button"
                  onClick={() => onEdit(snippet)}
                  className="btn-primary inline-flex items-center gap-2 rounded-control px-5 py-2 text-sm"
                >
                  <Pencil size={15} strokeWidth={1.75} aria-hidden="true" />
                  Edit
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}