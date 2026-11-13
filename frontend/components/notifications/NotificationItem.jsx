"use client";

import Link from "next/link";
import { AlarmClock, Bell, CalendarClock, ListChecks, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { notificationHref, notificationMessage } from "@/lib/notificationText";
import { formatRelative } from "@/lib/format";

// An icon and a colour for each kind. Colour is never the only signal: the words say it all.
const LOOK = {
  "task.assigned": { icon: ListChecks, tone: "text-ember-300" },
  "task.due_soon": { icon: CalendarClock, tone: "text-amber" },
  "task.overdue": { icon: AlarmClock, tone: "text-danger" },
  "member.added": { icon: UserPlus, tone: "text-success" },
  "member.role_changed": { icon: ShieldCheck, tone: "text-petrol-300" },
  "member.removed": { icon: UserMinus, tone: "text-danger" },
};

// One notification in the list. It's a real link when there's somewhere to go (so it opens in a
// new tab with a middle click), and a plain button when there isn't. Everything shown is text.
//   onSelect(notification): called when it's chosen, to mark it read and close the panel.
export default function NotificationItem({ notification, onSelect }) {
  const { segments } = notificationMessage(notification);
  const href = notificationHref(notification);
  const look = LOOK[notification.kind] ?? { icon: Bell, tone: "text-fg-2" };
  const Icon = look.icon;

  const content = (
    <>
      <span className={`notif-icon ${look.tone}`} aria-hidden="true">
        <Icon size={16} strokeWidth={1.75} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] leading-snug">
          {!notification.read && <span className="sr-only">Unread. </span>}
          {segments.map((piece, index) =>
            piece.strong ? (
              <strong key={index} className="font-medium text-fg">
                {piece.text}
              </strong>
            ) : (
              <span key={index} className="text-fg-2">
                {piece.text}
              </span>
            )
          )}
        </span>
        <span className="mt-1 block truncate text-[12px] text-fg-muted">
          {notification.workspace?.name} ·{" "}
          <time dateTime={notification.createdAt}>{formatRelative(notification.createdAt)}</time>
        </span>
      </span>

      {!notification.read && <span className="notif-dot" aria-hidden="true" />}
    </>
  );

  const className = `notif-item ${notification.read ? "" : "notif-item-unread"}`;

  return (
    <li>
      {href ? (
        <Link href={href} onClick={() => onSelect(notification)} className={className}>
          {content}
        </Link>
      ) : (
        <button type="button" onClick={() => onSelect(notification)} className={`${className} w-full text-left`}>
          {content}
        </button>
      )}
    </li>
  );
}