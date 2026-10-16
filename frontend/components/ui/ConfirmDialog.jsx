"use client";

import { useEffect, useId, useRef } from "react";
import { Loader2 } from "lucide-react";
import FormAlert from "@/components/auth/FormAlert";

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

// A modal that asks "are you sure?". Reusable for any destructive action.
// children: optional extra content (for example a "type the name" field).
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  loadingLabel = "Working…",
  danger = false,
  loading = false,
  confirmDisabled = false,
  error = "",
  onConfirm,
  onCancel,
  children,
}) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef(null);
  const cancelRef = useRef(null);

  // The key handler always needs the latest props, but the effect below must
  // only run when the dialog opens or closes (so typing never resets focus).
  const latest = useRef({ onCancel, loading });
  useEffect(() => {
    latest.current = { onCancel, loading };
  });

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Start on the first input if there is one, otherwise on Cancel (the safe choice).
    const firstInput = panelRef.current?.querySelector("input");
    (firstInput ?? cancelRef.current)?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape" && !latest.current.loading) {
        latest.current.onCancel();
        return;
      }

      // Keep Tab inside the dialog.
      if (event.key !== "Tab") return;
      const items = panelRef.current?.querySelectorAll(FOCUSABLE);
      if (!items || items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center px-4">
      <div
        aria-hidden="true"
        onClick={() => !loading && onCancel()}
        className="absolute inset-0 bg-void/75 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="glass dialog-panel relative w-full max-w-md rounded-panel p-6 sm:p-7"
      >
        <h2 id={titleId} className="font-display text-3xl leading-[1.1]">
          {title}
        </h2>
        <p id={descId} className="mt-2 text-[14px] leading-relaxed text-fg-2">
          {description}
        </p>

        {children && <div className="mt-5">{children}</div>}
        {error && (
          <div className="mt-4">
            <FormAlert message={error} />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
            className={`${danger ? "btn-danger" : "btn-primary"} inline-flex items-center gap-2 rounded-control px-4 py-2 text-sm`}
          >
            {loading && (
              <Loader2 size={15} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
            )}
            {loading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}