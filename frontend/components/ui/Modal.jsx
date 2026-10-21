"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

// A reusable dialog for forms. Mount it only while it should be open: it takes
// focus on mount, keeps Tab inside, closes on Esc or a click outside, locks page
// scroll, and gives focus back when it unmounts.
// busy: while true (saving), it can't be closed.
// size: "md" (default) or "lg" for content that needs more room, like code.
export default function Modal({ title, onClose, busy = false, size = "md", children }) {
  const titleId = useId();
  const panelRef = useRef(null);

  // The key handler always needs the latest props, but the effect below must
  // only run once (so typing never resets focus).
  const latest = useRef({ onClose, busy });
  useEffect(() => {
    latest.current = { onClose, busy };
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Start on the first field if there is one.
    const firstField = panelRef.current?.querySelector("input, textarea, select");
    (firstField ?? panelRef.current?.querySelector(FOCUSABLE))?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape" && !latest.current.busy) {
        latest.current.onClose();
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
  }, []);

  function closeIfIdle() {
    if (!busy) onClose();
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <div aria-hidden="true" className="absolute inset-0 bg-void/75 backdrop-blur-sm" />

      <div className="absolute inset-0 overflow-y-auto">
        <div
          className="grid min-h-full place-items-center p-4"
          onClick={(event) => event.target === event.currentTarget && closeIfIdle()}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`glass dialog-panel relative w-full ${
              size === "lg" ? "max-w-3xl" : "max-w-lg"
            } rounded-panel p-6 sm:p-7`}
          >
            <button
              type="button"
              onClick={closeIfIdle}
              disabled={busy}
              aria-label="Close"
              className="absolute right-4 top-4 grid size-9 place-items-center rounded-control text-fg-2 transition-colors hover:bg-white/10 hover:text-fg disabled:opacity-50"
            >
              <X size={18} strokeWidth={1.5} />
            </button>

            <h2 id={titleId} className="pr-10 font-display text-3xl leading-[1.1]">
              {title}
            </h2>

            <div className="mt-5">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}