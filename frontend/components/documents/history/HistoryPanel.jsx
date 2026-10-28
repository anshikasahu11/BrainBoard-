"use client";

import { useState } from "react";
import { History, Loader2, Save } from "lucide-react";
import SidePanel from "@/components/ui/SidePanel";
import FormAlert from "@/components/auth/FormAlert";
import KindBadge from "@/components/documents/history/KindBadge";
import { formatDateTime, formatRelative } from "@/lib/format";
import { createVersionRequest } from "@/services/versionService";

// versions: the useLoad result for the list ({ status, data: { versions, total }, error, retry }).
//   prepare(): saves anything the person has typed first. Resolves true when it's safe to go on.
export default function HistoryPanel({
  workspaceId,
  documentId,
  versions,
  prepare,
  onCreated,
  onOpen,
  onClose,
}) {
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSave(event) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      // A version is taken from what the server holds, so save what was just typed first.
      const ready = await prepare();
      if (!ready) {
        setError("Your latest changes haven’t finished saving yet. Try again in a moment.");
        return;
      }

      const { version } = await createVersionRequest(workspaceId, documentId, { label: label.trim() });
      setLabel("");
      setNotice(`Saved as version ${version.number}.`);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const list = versions.status === "ready" ? versions.data.versions : [];
  const total = versions.status === "ready" ? versions.data.total : 0;

  return (
    <SidePanel
      title="Version history"
      description="One earlier version is kept automatically every ten minutes of editing. Save one yourself whenever you want a point to come back to."
      onClose={onClose}
    >
      <form onSubmit={handleSave} noValidate className="space-y-3">
        <div>
          <label htmlFor="version-label" className="mb-1.5 block text-[13px] text-fg-2">
            Name this version <span className="text-fg-muted">(optional)</span>
          </label>
          <input
            id="version-label"
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={80}
            placeholder="e.g. Release candidate"
            autoComplete="off"
            disabled={saving}
            className="input"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-control px-4 py-2.5 text-sm"
        >
          {saving ? (
            <Loader2 size={15} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
          ) : (
            <Save size={15} strokeWidth={1.75} aria-hidden="true" />
          )}
          {saving ? "Saving…" : "Save a version"}
        </button>

        <FormAlert message={error} />
        <p role="status" aria-live="polite" className="min-h-5 text-[13px] text-success">
          {notice}
        </p>
      </form>

      <div className="mt-4 border-t border-line pt-5">
        <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-2">
          {versions.status === "ready" ? `${total} ${total === 1 ? "version" : "versions"}` : "Versions"}
        </h3>

        {versions.status === "loading" && (
          <div className="space-y-3" role="status" aria-live="polite">
            <div className="skeleton h-20 rounded-card" />
            <div className="skeleton h-20 rounded-card" />
            <span className="sr-only">Loading versions</span>
          </div>
        )}

        {/* Never show "no versions" when the real problem is a failed request. */}
        {versions.status === "error" && (
          <div className="space-y-3">
            <FormAlert message={versions.error} />
            <button
              type="button"
              onClick={versions.retry}
              className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
            >
              Try again
            </button>
          </div>
        )}

        {versions.status === "ready" && list.length === 0 && (
          <div className="flex gap-3 text-[13px] leading-relaxed text-fg-2">
            <span className="empty-icon">
              <History size={16} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <p>
              No versions yet. Once you change the text, an earlier version is kept here, and you can
              save one yourself above.
            </p>
          </div>
        )}

        {versions.status === "ready" && list.length > 0 && (
          <>
            <ul className="space-y-2">
              {list.map((version) => (
                <li key={version.number}>
                  <button
                    type="button"
                    onClick={() => onOpen(version.number)}
                    className={`version-item ${version.kind === "manual" ? "version-item-named" : ""}`}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-medium">Version {version.number}</span>
                      <KindBadge kind={version.kind} />
                    </span>

                    {version.label && (
                      <span className="mt-1 block truncate text-[13px] text-fg">{version.label}</span>
                    )}

                    {version.excerpt ? (
                      <span className="mt-1 line-clamp-2 block text-[12px] leading-relaxed text-fg-2">
                        {version.excerpt}
                      </span>
                    ) : (
                      <span className="mt-1 block text-[12px] italic text-fg-muted">No text</span>
                    )}

                    <span
                      className="mt-2 block truncate font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted"
                      title={formatDateTime(version.savedAt)}
                    >
                      {version.editedBy.name} · {formatRelative(version.savedAt)} ·{" "}
                      {version.charCount.toLocaleString("en-US")} characters
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {total > list.length && (
              <p className="mt-3 text-[12px] text-fg-muted">
                Showing the latest {list.length} of {total}.
              </p>
            )}
          </>
        )}
      </div>
    </SidePanel>
  );
}