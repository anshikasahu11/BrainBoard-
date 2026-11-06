"use client";

import { useMemo, useState } from "react";
import { Activity as ActivityIcon, Loader2, SearchX } from "lucide-react";
import PageHeading from "@/components/app/PageHeading";
import Reveal from "@/components/Reveal";
import FormAlert from "@/components/auth/FormAlert";
import ActivityFilters from "@/components/activity/ActivityFilters";
import ActivityItem from "@/components/activity/ActivityItem";
import { EmptyHint } from "@/components/dashboard/DashboardCard";
import useActivityFeed from "@/hooks/useActivityFeed";
import useAuth from "@/hooks/useAuth";
import useLiveEvents from "@/hooks/useLiveEvents";
import useMembers from "@/hooks/useMembers";
import useWorkspace from "@/hooks/useWorkspace";
import { describeActivity, groupByDay, matchesFilters, plainText } from "@/lib/activityText";

export default function ActivityPanel() {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const people = useMembers(workspace.id);

  const [category, setCategory] = useState("");
  const [actor, setActor] = useState("");
  const filters = { category, actor };
  const filtersActive = Boolean(category || actor);

  const feed = useActivityFeed(workspace.id, filters);

  // New entries that arrive while you're scrolled down reading wait here, instead of
  // pushing everything down under your eyes. They belong to the filters they arrived under.
  const [pending, setPending] = useState({ key: "", items: [] });
  const waiting = pending.key === feed.filterKey ? pending.items : [];

  // Read out politely to screen readers when something new happens.
  const [announcement, setAnnouncement] = useState("");

  const groups = useMemo(() => groupByDay(feed.items), [feed.items]);

  // ----- Live updates -----
  useLiveEvents({
    "activity:created": (payload) => {
      if (payload?.workspaceId !== workspace.id || !payload.activity) return;

      const activity = payload.activity;
      if (!matchesFilters(activity, filters, user.id)) return;

      if (window.scrollY > 160) {
        // Scrolled down: hold it back and offer a button.
        setPending((current) => {
          const items = current.key === feed.filterKey ? current.items : [];
          return items.some((item) => item.id === activity.id)
            ? current
            : { key: feed.filterKey, items: [activity, ...items] };
        });
      } else {
        feed.addLive(activity);
      }

      setAnnouncement(
        `New activity: ${plainText(describeActivity(activity, { workspaceId: workspace.id, userId: user.id }))}.`
      );
    },
    // We were offline for a while, so entries may have been missed.
    "connection:restored": () => feed.reload(),
  });

  function showWaiting() {
    feed.addMany(waiting);
    setPending({ key: feed.filterKey, items: [] });

    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" });
  }

  function clearFilters() {
    setCategory("");
    setActor("");
  }

  const empty = feed.status === "ready" && feed.items.length === 0;

  return (
    <div>
      <PageHeading
        eyebrow="Activity"
        title="What’s been happening"
        description="Everything that’s changed in this workspace, newest first."
      />

      <Reveal level="subtle" className="mt-8">
        <ActivityFilters
          category={category}
          onCategory={setCategory}
          actor={actor}
          onActor={setActor}
          members={people.members}
          currentUserId={user.id}
          active={filtersActive}
          onClear={clearFilters}
        />
      </Reveal>

      {/* Announces new entries without moving focus. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {waiting.length > 0 && (
        <div className="activity-pill-wrap">
          <button
            type="button"
            onClick={showWaiting}
            className="btn-primary rounded-full px-4 py-2 text-[13px] shadow-lg"
          >
            Show {waiting.length} new {waiting.length === 1 ? "activity" : "activities"}
          </button>
        </div>
      )}

      <div className="mt-8" aria-busy={feed.status === "loading" || feed.refreshing}>
        {feed.status === "loading" && (
          <div className="space-y-4" role="status" aria-live="polite">
            <div className="skeleton h-14 rounded-card" />
            <div className="skeleton h-14 rounded-card" />
            <div className="skeleton h-14 rounded-card" />
            <div className="skeleton h-14 rounded-card" />
            <span className="sr-only">Loading activity</span>
          </div>
        )}

        {/* Never show "nothing happened" when the real problem is a failed request. */}
        {feed.status === "error" && (
          <div className="max-w-md space-y-4">
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

        {empty && !filtersActive && (
          <div className="glass max-w-xl rounded-card p-6">
            <EmptyHint icon={ActivityIcon} title="Nothing has happened yet">
              Create a document, add a task or invite a teammate, and it will show up here for
              everyone in the workspace.
            </EmptyHint>
          </div>
        )}

        {empty && filtersActive && (
          <div className="glass max-w-xl rounded-card p-6">
            <EmptyHint icon={SearchX} title="No activity matches">
              Try a different kind of activity or person.
            </EmptyHint>
            <button
              type="button"
              onClick={clearFilters}
              className="btn-ghost mt-5 inline-flex items-center rounded-control px-4 py-2 text-sm"
            >
              Clear filters
            </button>
          </div>
        )}

        {feed.status === "ready" && feed.items.length > 0 && (
          <div className={`space-y-8 transition-opacity duration-200 ${feed.refreshing ? "opacity-60" : ""}`}>
            {groups.map((group) => (
              <section key={group.key} aria-label={group.label}>
                <h2 className="activity-day-heading">{group.label}</h2>
                <ol className="glass mt-3 rounded-card px-5">
                  {group.items.map((activity) => (
                    <ActivityItem
                      key={activity.id}
                      activity={activity}
                      workspaceId={workspace.id}
                      userId={user.id}
                    />
                  ))}
                </ol>
              </section>
            ))}

            <div className="space-y-3">
              {feed.moreError && <FormAlert message={feed.moreError} />}

              {feed.hasMore ? (
                <button
                  type="button"
                  onClick={feed.loadMore}
                  disabled={feed.loadingMore}
                  className="btn-ghost inline-flex items-center gap-2 rounded-control px-5 py-2.5 text-sm"
                >
                  {feed.loadingMore && (
                    <Loader2 size={15} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
                  )}
                  {feed.loadingMore ? "Loading…" : "Load more"}
                </button>
              ) : (
                <p className="text-[12px] leading-relaxed text-fg-muted">
                  That’s everything from the last 180 days. Older activity is removed automatically.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}