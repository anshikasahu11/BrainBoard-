"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import FormAlert from "@/components/auth/FormAlert";
import KindBadge from "@/components/documents/history/KindBadge";
import ReadOnlyDocument from "@/components/documents/history/ReadOnlyDocument";
import { canDeleteVersion } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import {
  deleteVersionRequest,
  getVersionRequest,
  restoreVersionRequest,
} from "@/services/versionService";

// Opens one version, read-only, with its full text. Mount it only while it's open.
//   restoreBlocked: a sentence saying why restoring isn't possible right now, or null.
//   prepare():      saves anything the person has typed first. Resolves true when it's safe to go on.
//   getRevision():  the revision the editor is on (so the server can spot a newer save).
//   onRestored(n):  the version was put back.
//   onDeleted():    the version was deleted.
//   onGone():       the version (or document) no longer exists.
//   onLoadLatest(): load the newest version of the document into the editor.
export default function VersionViewer({
  workspaceId,
  documentId,
  number,
  role,
  restoreBlocked,
  prepare,
  getRevision,
  onRestored,
  onDeleted,
  onGone,
  onLoadLatest,
  onClose,
}) {
  const [state, setState] = useState({ status: "loading" });
  const [confirming, setConfirming] = useState(null); // "restore" | "delete" | null
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newer, setNewer] = useState(false); // the server says a newer version of the document exists

  useEffect(() => {
    let cancelled = false;

    getVersionRequest(workspaceId, documentId, number)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", version: data.version });
      })
      .catch((err) => {
        if (cancelled) return;
        // 404 covers "deleted" and "never existed".
        setState(err.status === 404 ? { status: "notfound" } : { status: "error", message: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, documentId, number]);

  async function handleRestore() {
    setBusy(true);
    setError("");
    setNewer(false);

    try {
      // Save whatever was just typed first, so the "before restoring" backup contains it.
      const ready = await prepare();
      if (!ready) {
        setError(
          "Your latest changes haven’t finished saving, so restoring now could lose them. Try again in a moment."
        );
        setBusy(false);
        return;
      }

      await restoreVersionRequest(workspaceId, documentId, number, getRevision());
      // The parent reloads the document. We leave "busy" on so nothing flickers.
      onRestored(number);
    } catch (err) {
      if (err.status === 409) {
        setNewer(true);
        setError(
          "Someone saved a newer version of this document while you were looking. Load the latest version, then restore again if you still want to."
        );
      } else if (err.status === 404) {
        onGone();
        return;
      } else {
        setError(err.message);
      }
      setConfirming(null);
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setError("");

    try {
      await deleteVersionRequest(workspaceId, documentId, number);
      onDeleted();
    } catch (err) {
      if (err.status === 404) {
        onGone();
        return;
      }
      setError(err.message);
      setConfirming(null);
      setBusy(false);
    }
  }

  const version = state.status === "ready" ? state.version : null;

  return (
    <Modal title={`Version ${number}`} onClose={onClose} busy={busy} size="lg">
      {state.status === "loading" && (
        <div role="status" aria-live="polite">
          <div className="skeleton h-48 rounded-card" />
          <span className="sr-only">Loading version</span>
        </div>
      )}

      {state.status === "notfound" && (
        <div className="space-y-4">
          <p className="text-[15px] leading-relaxed text-fg-2">
            This version no longer exists. It may have been deleted.
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

      {version && (
        <div className="space-y-4">
          <FormAlert message={error} />

          {newer && (
            <button
              type="button"
              onClick={onLoadLatest}
              className="btn-primary inline-flex items-center rounded-control px-4 py-2 text-[13px]"
            >
              Load latest version
            </button>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <KindBadge kind={version.kind} />
            {version.label && <span className="text-[14px] font-medium">{version.label}</span>}
          </div>

          <p className="text-[13px] leading-relaxed text-fg-2">
            “{version.title}”, written by {version.editedBy.name}, saved{" "}
            {formatDateTime(version.savedAt)}.
            {version.createdBy && (
              <>
                {" "}
                Kept by {version.createdBy.name} on {formatDateTime(version.createdAt)}.
              </>
            )}
          </p>

          <div
            role="region"
            tabIndex={0}
            aria-label={`Text of version ${number}, read only`}
            className="editor-card readonly-box"
          >
            <ReadOnlyDocument content={version.content} label={`Text of version ${number}`} />
          </div>

          {confirming === "restore" ? (
            <div className="rounded-card border border-line-strong bg-white/5 p-4">
              <p className="text-[14px]">Restore version {number}?</p>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-2">
                The document goes back to the text and title from {formatDateTime(version.savedAt)}.
                What’s there now is kept as a new version, “Before restoring version {number}”, so
                you can undo this.
              </p>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  disabled={busy}
                  className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={busy}
                  className="btn-primary inline-flex items-center gap-2 rounded-control px-4 py-2 text-sm"
                >
                  {busy && (
                    <Loader2 size={15} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
                  )}
                  {busy ? "Restoring…" : "Restore version"}
                </button>
              </div>
            </div>
          ) : confirming === "delete" ? (
            <div className="rounded-card border border-danger/40 bg-scorched/60 p-4">
              <p className="text-[14px]">Delete version {number}?</p>
              <p className="mt-1 text-[13px] text-fg-2">
                It’s removed from the history for everyone. This can’t be undone.
              </p>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
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
                  {busy ? "Deleting…" : "Delete version"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {restoreBlocked && <p className="text-[13px] leading-relaxed text-amber">{restoreBlocked}</p>}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div>
                  {canDeleteVersion(role) && (
                    <button
                      type="button"
                      onClick={() => setConfirming("delete")}
                      className="inline-flex items-center gap-2 rounded-control px-3 py-2 text-[13px] text-fg-2 transition-colors hover:bg-white/10 hover:text-danger"
                    >
                      <Trash2 size={15} strokeWidth={1.5} aria-hidden="true" />
                      Delete
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming("restore")}
                    disabled={Boolean(restoreBlocked)}
                    className="btn-primary inline-flex items-center gap-2 rounded-control px-5 py-2 text-sm"
                  >
                    <RotateCcw size={15} strokeWidth={1.75} aria-hidden="true" />
                    Restore this version
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}