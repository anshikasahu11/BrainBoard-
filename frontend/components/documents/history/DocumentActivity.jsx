"use client";

import { History as HistoryIcon, Loader2 } from "lucide-react";
import ActivityItem from "@/components/activity/ActivityItem";
import FormAlert from "@/components/auth/FormAlert";
import useActivityFeed from "@/hooks/useActivityFeed";
import useAuth from "@/hooks/useAuth";
import useLiveEvents from "@/hooks/useLiveEvents";
import { matchesFilters } from "@/lib/activityText";

// One document's story: who created it, renamed it, edited it, saved or restored versions.
// It shows only while the Activity tab is open, and keeps itself live.
export default function DocumentActivity({ workspaceId, documentId }) {
  const { user } = useAuth();
  const filters = { target: documentId };
  const feed = useActivityFeed(workspaceId, filters);

  useLiveEvents({
    "activity:created": (payload) => {
      if (payload?.workspaceId !== workspaceId || !payload.activity) return;
      if (matchesFilters(payload.activity, filters, user.id)) feed.addLive(payload.activity);
    },
    // We were offline for a while, so entries may have been missed.
    "connection:restored": () => feed.reload(),
  });

  return (
    <div>
      {feed.status === "loading" && (
        <div className="space-y-3" role="status" aria-live="polite">
          <div className="skeleton h-14 rounded-card" />
          <div className="skeleton h-14 rounded-card" />
          <span className="sr-only">Loading activity</span>
        </div>
      )}

      {/* Never show "no activity" when the real problem is a failed request. */}
      {feed.status === "error" && (
        <div className="space-y-3">
          <FormAlert message={feed.error} />
          <button
            type="button"
            onClick={feed.retry}
            className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
          >
            Try again
          </button>
        </div>
      )}

      {feed.status === "ready" && feed.items.length === 0 && (
        <div className="flex gap-3 text-[13px] leading-relaxed text-fg-2">
          <span className="empty-icon">
            <HistoryIcon size={16} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <p>
            Nothing has been recorded for this document yet. From now on, renames, edits and
            versions will show up here.
          </p>
        </div>
      )}

      {feed.status === "ready" && feed.items.length > 0 && (
        <>
          <ol>
            {feed.items.map((activity) => (
              <ActivityItem
                key={activity.id}
                activity={activity}
                workspaceId={workspaceId}
                userId={user.id}
                compact
                linkTarget={false}
              />
            ))}
          </ol>

          <div className="mt-4 space-y-3">
            {feed.moreError && <FormAlert message={feed.moreError} />}

            {feed.hasMore ? (
              <button
                type="button"
                onClick={feed.loadMore}
                disabled={feed.loadingMore}
                className="btn-ghost inline-flex items-center gap-2 rounded-control px-4 py-2 text-sm"
              >
                {feed.loadingMore && (
                  <Loader2 size={15} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
                )}
                {feed.loadingMore ? "Loading…" : "Load more"}
              </button>
            ) : (
              <p className="text-[12px] leading-relaxed text-fg-muted">
                That’s the whole recorded history of this document.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}