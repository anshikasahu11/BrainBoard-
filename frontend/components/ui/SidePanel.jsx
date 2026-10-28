"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

// A panel that slides in from the right (version history uses it). Mount it only while
// it should be open. It works like Modal: it takes focus, keeps Tab inside, closes on
// Esc or a click outside, locks page scroll, and gives focus back when it unmounts.
export default function SidePanel({ title, description, onClose, children }) {
  const titleId = useId();
  const panelRef = useRef(null);

  // The key handler always needs the latest onClose, but the effect below must
  // only run once.
  const latest = useRef({ onClose });
  useEffect(() => {
    latest.current = { onClose };
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the panel itself, so a screen reader announces its title first.
    panelRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        latest.current.onClose();
        return;
      }

      // Keep Tab inside the panel.
      if (event.key !== "Tab") return;
      const items = panelRef.current?.querySelectorAll(FOCUSABLE);
      if (!items || items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
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

  return (
    <div className="fixed inset-0 z-[55]">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-void/60 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="drawer-panel-right absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-line bg-sidebar/95 outline-none backdrop-blur-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-3xl leading-[1.1]">
              {title}
            </h2>
            {description && (
              <p className="mt-2 text-[13px] leading-relaxed text-fg-2">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 shrink-0 place-items-center rounded-control text-fg-2 transition-colors hover:bg-white/10 hover:text-fg"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}