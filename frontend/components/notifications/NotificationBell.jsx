"use client";

import { useCallback, useRef, useState } from "react";
import { Bell } from "lucide-react";
import NotificationPanel from "@/components/notifications/NotificationPanel";
import { useNotifications } from "@/context/NotificationsContext";
import { badgeText, bellLabel } from "@/lib/notificationState";

// The bell button with its unread badge. Clicking it opens the dropdown.
// There are two of these on the page (the sidebar's and the top bar's), and CSS shows one at a
// time. They share their numbers through NotificationsProvider.
export default function NotificationBell() {
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);

  const close = useCallback((returnFocus) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  const badge = badgeText(unreadCount);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={bellLabel(unreadCount)}
        className="notif-bell"
      >
        <Bell size={18} strokeWidth={1.5} aria-hidden="true" />
        {badge && (
          <span className="notif-badge" aria-hidden="true">
            {badge}
          </span>
        )}
      </button>

      {open && <NotificationPanel anchorRef={buttonRef} onClose={close} />}
    </>
  );
}