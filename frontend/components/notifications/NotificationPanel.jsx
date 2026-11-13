"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCheck } from "lucide-react";
import FormAlert from "@/components/auth/FormAlert";
import NotificationItem from "@/components/notifications/NotificationItem";
import { useNotifications } from "@/context/NotificationsContext";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

// The dropdown. It's drawn on top of the whole page at a fixed position, because the sidebar
// scrolls and would cut off anything placed inside it. Mount it only while it's open.
//   anchorRef: the bell button, to sit under it.
//   onClose(returnFocus): closes it. returnFocus puts keyboard focus back on the bell.
export default function NotificationPanel({ anchorRef, onClose }) {
  const { status, items, unreadCount, error, actionError, reload, refresh, markRead, markAllRead, clearActionError } =
    useNotifications();

  const titleId = useId();
  const panelRef = useRef(null);
  const focused = useRef(false);
  const [position, setPosition] = useState(null);

  // The key handlers always need the newest onClose, but must only be set up once.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Fresh data every time it opens, and no old error message.
  useEffect(() => {
    clearActionError();
    refresh();
  }, [clearActionError, refresh]);

  // Sit under the bell, kept on screen, and follow it if the window changes.
  useLayoutEffect(() => {
    function place() {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const width = Math.min(380, window.innerWidth - 16);
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      const top = rect.bottom + 8;

      setPosition({
        left,
        top,
        width,
        maxHeight: Math.max(220, Math.min(window.innerHeight - top - 12, window.innerHeight * 0.75)),
      });
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorRef]);

  // Once it's in place, move keyboard focus inside it.
  useEffect(() => {
    if (!position || focused.current) return;
    focused.current = true;

    const first = panelRef.current?.querySelector(FOCUSABLE);
    (first ?? panelRef.current)?.focus();
  }, [position]);

  // Esc closes it (and returns focus to the bell), Tab stays inside it, and clicking elsewhere closes it.
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current(true);
        return;
      }
      if (event.key !== "Tab") return;

      const nodes = panelRef.current?.querySelectorAll(FOCUSABLE);
      if (!nodes || nodes.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function onPointerDown(event) {
      const target = event.target;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      closeRef.current(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [anchorRef]);

  // Choosing one reads it and closes the panel. A link then takes you where it leads.
  function handleSelect(notification) {
    markRead(notification.id);
    closeRef.current(false);
  }

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="notif-panel"
      style={position ?? { visibility: "hidden" }}
    >
      <div className="notif-head">
        <h2 id={titleId} className="font-display text-2xl leading-none">
          Notifications
        </h2>
        <button type="button" onClick={markAllRead} disabled={unreadCount === 0} className="notif-link">
          <CheckCheck size={14} strokeWidth={1.75} aria-hidden="true" />
          Mark all as read
        </button>
      </div>

      <div className="notif-scroll" aria-busy={status === "loading"}>
        {actionError && (
          <div className="px-4 pb-3">
            <FormAlert message={actionError} />
          </div>
        )}

        {status === "loading" && (
          <div className="space-y-2 p-4" role="status" aria-live="polite">
            <div className="skeleton h-14 rounded-card" />
            <div className="skeleton h-14 rounded-card" />
            <div className="skeleton h-14 rounded-card" />
            <span className="sr-only">Loading notifications</span>
          </div>
        )}

        {/* Never show "all caught up" when the real problem is a failed request. */}
        {status === "error" && (
          <div className="space-y-3 p-4">
            <FormAlert message={error} />
            <button
              type="button"
              onClick={reload}
              className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
            >
              Try again
            </button>
          </div>
        )}

        {status === "ready" && items.length === 0 && (
          <div className="px-6 py-10 text-center">
            <Bell size={22} strokeWidth={1.25} className="mx-auto text-fg-muted" aria-hidden="true" />
            <p className="mt-3 text-[14px]">You’re all caught up</p>
            <p className="mt-1 text-[13px] leading-relaxed text-fg-2">
              Things that need your attention will show up here.
            </p>
          </div>
        )}

        {status === "ready" && items.length > 0 && (
          <ul>
            {items.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} onSelect={handleSelect} />
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body
  );
}