"use client";

import CodeBlock from "@/components/snippets/CodeBlock";
import CopyButton from "@/components/snippets/CopyButton";
import useWorkspace from "@/hooks/useWorkspace";
import { getSnippetRequest } from "@/services/snippetService";
import { languageInfo } from "@/lib/snippets";
import { formatRelative } from "@/lib/format";

const PREVIEW_LINES = 12;

// The whole card opens the snippet (the title button stretches over it), while
// Copy and the tag chips stay separate buttons on top.
export default function SnippetCard({ snippet, onOpen, onTagClick }) {
  const { workspace } = useWorkspace();
  const language = languageInfo(snippet.language);
  const moreLines = snippet.lineCount - PREVIEW_LINES;
  const lines = `${snippet.lineCount} ${snippet.lineCount === 1 ? "line" : "lines"}`;

  return (
    <li className="snippet-card glass rounded-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[16px] font-medium">
            <button
              type="button"
              onClick={() => onOpen(snippet)}
              className="snippet-open block max-w-full truncate text-left"
            >
              {snippet.title}
            </button>
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="language-chip">{language.label}</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
              {lines}
            </span>
          </div>
        </div>

        <CopyButton
          subject={snippet.title}
          className="snippet-above shrink-0"
          // The list only has a preview, so fetch the full code at the moment of the click.
          getText={() =>
            getSnippetRequest(workspace.id, snippet.id).then((data) => data.snippet.code)
          }
        />
      </div>

      {snippet.description && (
        <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-fg-2">
          {snippet.description}
        </p>
      )}

      <div className="code-preview mt-4">
        <CodeBlock code={snippet.preview} language={snippet.language} className="code-block-preview" />
        {snippet.truncated && <div className="code-preview-fade" aria-hidden="true" />}
      </div>

      {snippet.truncated && (
        <p className="mt-2 text-[12px] text-fg-muted">
          {moreLines > 0 ? `+${moreLines} more ${moreLines === 1 ? "line" : "lines"}` : "Preview shortened"}
        </p>
      )}

      {snippet.tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Tags">
          {snippet.tags.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onClick={() => onTagClick(tag)}
                className="tag-chip snippet-above"
                aria-label={`Filter by tag ${tag}`}
              >
                {tag}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 truncate font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
        Edited {formatRelative(snippet.updatedAt)} · {snippet.lastEditedBy.name}
      </p>
    </li>
  );
}