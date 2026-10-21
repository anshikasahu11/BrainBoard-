"use client";

import { useState } from "react";
import { FileCode, Plus, SearchX } from "lucide-react";
import PageHeading from "@/components/app/PageHeading";
import Reveal from "@/components/Reveal";
import FormAlert from "@/components/auth/FormAlert";
import { EmptyHint } from "@/components/dashboard/DashboardCard";
import SnippetCard from "@/components/snippets/SnippetCard";
import SnippetFilters from "@/components/snippets/SnippetFilters";
import SnippetForm from "@/components/snippets/SnippetForm";
import SnippetViewer from "@/components/snippets/SnippetViewer";
import useAuth from "@/hooks/useAuth";
import useDebounce from "@/hooks/useDebounce";
import useLoad from "@/hooks/useLoad";
import useSnippets from "@/hooks/useSnippets";
import useWorkspace from "@/hooks/useWorkspace";
import { listTagsRequest } from "@/services/snippetService";

export default function SnippetsPanel() {
  const { workspace, role } = useWorkspace();
  const { user } = useAuth();

  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("");
  const [tag, setTag] = useState("");
  const typedQuery = query.trim();
  const debouncedQuery = useDebounce(typedQuery, 300);

  const list = useSnippets(workspace.id, { q: debouncedQuery, language, tag });
  const tags = useLoad(`snippet-tags:${workspace.id}`, () => listTagsRequest(workspace.id));

  // { mode: "view", id } | { mode: "form", snippet? } | null
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState("");

  const filtersActive = Boolean(typedQuery || language || tag);

  function clearFilters() {
    setQuery("");
    setLanguage("");
    setTag("");
  }

  // After any change: close the dialog, say what happened, and refresh the list and tags.
  function finish(message) {
    setDialog(null);
    setNotice(message);
    list.reload();
    tags.reload();
  }

  // What screen readers hear when the list changes.
  let summary = "";
  if (list.status === "ready" && !list.refreshing) {
    const count = list.snippets.length;
    const noun = count === 1 ? "snippet" : "snippets";
    summary = filtersActive ? `${count} ${noun} match` : `${count} ${noun}`;
    if (list.total > count) summary += ` (showing the latest ${count} of ${list.total})`;
  }

  const noSnippetsAtAll = list.status === "ready" && list.snippets.length === 0 && !filtersActive;
  const noMatches = list.status === "ready" && list.snippets.length === 0 && filtersActive;

  return (
    <div>
      <PageHeading
        eyebrow="Snippets"
        title="Your code"
        description="Save the code your team reaches for again and again, then copy it in one click."
      />

      <Reveal level="subtle" className="mt-8">
        <div className="flex flex-wrap items-center gap-3">
          <SnippetFilters
            query={query}
            onQuery={(value) => {
              setQuery(value);
              setNotice("");
            }}
            language={language}
            onLanguage={setLanguage}
            tag={tag}
            onTag={setTag}
            tags={tags.status === "ready" ? tags.data.tags : []}
            active={filtersActive}
            onClear={clearFilters}
          />

          <button
            type="button"
            onClick={() => setDialog({ mode: "form" })}
            className="btn-primary inline-flex h-11 shrink-0 items-center gap-2 rounded-control px-5 text-sm"
          >
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
            New snippet
          </button>
        </div>
      </Reveal>

      <p
        role="status"
        aria-live="polite"
        className="mt-5 min-h-5 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted"
      >
        {notice || summary}
      </p>

      <div className="mt-3" aria-busy={list.status === "loading" || list.refreshing}>
        {list.status === "loading" && (
          <div className="space-y-4" role="status" aria-live="polite">
            <div className="skeleton h-[280px] rounded-card" />
            <div className="skeleton h-[280px] rounded-card" />
            <span className="sr-only">Loading snippets</span>
          </div>
        )}

        {/* Never show an empty list when the real problem is a failed request. */}
        {list.status === "error" && (
          <div className="max-w-md space-y-4">
            <FormAlert message={list.error} />
            <button
              type="button"
              onClick={list.retry}
              className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
            >
              Try again
            </button>
          </div>
        )}

        {noSnippetsAtAll && (
          <div className="glass max-w-xl rounded-card p-6">
            <EmptyHint icon={FileCode} title="No snippets yet">
              Save your first one: a query, a config, a helper function. Everyone in this
              workspace can find it, copy it and improve it.
            </EmptyHint>
            <button
              type="button"
              onClick={() => setDialog({ mode: "form" })}
              className="btn-primary mt-5 inline-flex items-center gap-2 rounded-control px-4 py-2 text-sm"
            >
              <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              New snippet
            </button>
          </div>
        )}

        {noMatches && (
          <div className="glass max-w-xl rounded-card p-6">
            <EmptyHint icon={SearchX} title="No snippets match">
              Try a different word, language or tag.
            </EmptyHint>
            <button
              type="button"
              onClick={clearFilters}
              className="btn-ghost mt-5 inline-flex items-center rounded-control px-4 py-2 text-sm"
            >
              Clear filters
            </button>
          </div>
        )}

        {list.status === "ready" && list.snippets.length > 0 && (
          <ul className={`space-y-4 transition-opacity duration-200 ${list.refreshing ? "opacity-60" : ""}`}>
            {list.snippets.map((snippet) => (
              <SnippetCard
                key={snippet.id}
                snippet={snippet}
                onOpen={(item) => setDialog({ mode: "view", id: item.id })}
                onTagClick={(name) => {
                  setTag(name);
                  setNotice("");
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {dialog?.mode === "view" && (
        <SnippetViewer
          key={dialog.id}
          snippetId={dialog.id}
          workspaceId={workspace.id}
          role={role}
          userId={user.id}
          onEdit={(snippet) => setDialog({ mode: "form", snippet })}
          onDeleted={(snippet) => finish(`“${snippet.title}” was deleted.`)}
          onGone={() => finish("That snippet no longer exists.")}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.mode === "form" && (
        <SnippetForm
          key={dialog.snippet?.id ?? "new"}
          snippet={dialog.snippet}
          workspaceId={workspace.id}
          onSaved={(snippet, verb) => finish(`“${snippet.title}” was ${verb}.`)}
          onGone={() => finish("That snippet no longer exists.")}
          // "Load latest version": go back to the viewer, which fetches it fresh.
          onReload={(id) => setDialog({ mode: "view", id })}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}