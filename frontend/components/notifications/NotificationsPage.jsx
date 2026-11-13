"use client";

import { useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import PageHeading from "@/components/app/PageHeading";
import Reveal from "@/components/Reveal";
import FormAlert from "@/components/auth/FormAlert";
import { EmptyHint } from "@/components/dashboard/DashboardCard";
import NotificationItem from "@/components/notifications/NotificationItem";
import NotificationsNav from "@/components/notifications/NotificationsNav";
import { useNotifications } from "@/context/NotificationsContext";
import useNotificationList from "@/hooks/useNotificationList";
import useWorkspace from "@/hooks/useWorkspace";
import { emptyCopy, summaryText } from "@/lib/notificationList";

// Everything sent to this person, from every workspace they're in (or just this one).
export default function NotificationsPage() {
  const { workspace } = useWorkspace();
  const bell = useNotifications();

  const [unreadOnly, setUnreadOnly] = useState(false);
  const [everywhere, setEverywhere] = useState(true);
  const [notice, setNotice] = useState("");

  // After anything is read or dismissed here, the bell refreshes so the two agree.
  const list = useNotificationList({
    unread: unreadOnly,
    workspace: everywhere ? "" : workspace.id,
    onChanged: bell.refresh,
  });

  const empty = emptyCopy({ unread: unreadOnly, everywhere });
  const showEmpty = list.status === "ready" && list.items.length === 0 && !list.hasMore;

  function changeFilter(change) {
    setNotice("");
    list.clearProblem();
    change();
  }

  return (
    <div>
      <PageHeading
        eyebrow="Notifications"
        title="What needs you"
        description="Everything sent to you, from every workspace you’re in."
      />

      <Reveal level="subtle" className="mt-8">
        <NotificationsNav workspaceId={workspace.id} />
      </Reveal>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="seg" role="group" aria-label="Which notifications">
          <button
            type="button"
            aria-pressed={!unreadOnly}
            onClick={() => changeFilter(() => setUnreadOnly(false))}
            className={`seg-btn ${!unreadOnly ? "seg-btn-active" : ""}`}
          >
            All
          </button>
          <button
            type="button"
            aria-pressed={unreadOnly}
            onClick={() => changeFilter(() => setUnreadOnly(true))}
            className={`seg-btn ${unreadOnly ? "seg-btn-active" : ""}`}
          >
            Unread
          </button>
        </div>

        <div className="seg" role="group" aria-label="Where from">
          <button
            type="button"
            aria-pressed={everywhere}
            onClick={() => changeFilter(() => setEverywhere(true))}
            className={`seg-btn ${everywhere ? "seg-btn-active" : ""}`}
          >
            All workspaces
          </button>
          <button
            type="button"
            aria-pressed={!everywhere}
            onClick={() => changeFilter(() => setEverywhere(false))}
            className={`seg-btn ${!everywhere ? "seg-btn-active" : ""}`}
          >
            This workspace
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setNotice("Marked everything as read.");
            list.markAllRead();
          }}
          disabled={list.unreadCount === 0}
          className="btn-ghost inline-flex h-10 items-center gap-2 rounded-control px-4 text-sm"
        >
          <CheckCheck size={15} strokeWidth={1.5} aria-hidden="true" />
          Mark all as read
        </button>
      </div>

      <p className="mt-4 min-h-5 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
        {list.status === "ready" &&
          `${summaryText({ count: list.items.length, hasMore: list.hasMore, unread: unreadOnly, everywhere })}${
            list.unreadCount > 0 ? ` · ${list.unreadCount} unread in total` : ""
          }`}
      </p>

      {!everywhere && list.unreadCount > 0 && (
        <p className="mt-1 text-[12px] text-fg-muted">“Mark all as read” marks every workspace, not only this one.</p>
      )}

      {/* Announces what you just did, politely. */}
      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-[13px] text-success">
        {notice}
      </p>

      {list.problem && (
        <div className="mb-4 max-w-xl">
          <FormAlert message={list.problem} />
        </div>
      )}

      <div className="mt-2" aria-busy={list.status === "loading"}>
        {list.status === "loading" && (
          <div className="space-y-3" role="status" aria-live="polite">
            <div className="skeleton h-[72px] rounded-card" />
            <div className="skeleton h-[72px] rounded-card" />
            <div className="skeleton h-[72px] rounded-card" />
            <span className="sr-only">Loading notifications</span>
          </div>
        )}

        {/* Never show "nothing here" when the real problem is a failed request. */}
        {list.status === "error" && (
          <div className="max-w-md space-y-4">
            <FormAlert message={list.error} />
            <button
              type="button"
              onClick={list.reload}
              className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
            >
              Try again
            </button>
          </div>
        )}

        {showEmpty && (
          <div className="glass max-w-xl rounded-card p-6">
            <EmptyHint icon={Bell} title={empty.title}>
              {empty.text}
            </EmptyHint>
          </div>
        )}

        {list.status === "ready" && list.items.length > 0 && (
          <ul className="glass overflow-hidden rounded-card">
            {list.items.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onSelect={(item) => list.markRead(item.id)}
                onDismiss={(item) => {
                  setNotice("Dismissed.");
                  list.dismiss(item.id);
                }}
              />
            ))}
          </ul>
        )}

        {list.status === "ready" && list.hasMore && (
          <div className="mt-5">
            <button
              type="button"
              onClick={list.loadMore}
              disabled={list.loadingMore}
              className="btn-ghost inline-flex items-center gap-2 rounded-control px-5 py-2 text-sm"
            >
              {list.loadingMore && (
                <Loader2 size={15} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
              )}
              {list.loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}