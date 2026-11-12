"use client";

import { Activity as ActivityIcon } from "lucide-react";
import ActivityItem from "@/components/activity/ActivityItem";
import FormAlert from "@/components/auth/FormAlert";
import DashboardCard, { EmptyHint } from "@/components/dashboard/DashboardCard";
import useActivityFeed from "@/hooks/useActivityFeed";
import useAuth from "@/hooks/useAuth";
import useLiveEvents from "@/hooks/useLiveEvents";
import useWorkspace from "@/hooks/useWorkspace";

const SHOW = 6;

// The newest few entries of the workspace's history. New ones fade in at the top by themselves.
// (The Activity page announces new entries to screen readers. This card stays quiet.)
export default function RecentActivityCard() {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const feed = useActivityFeed(workspace.id, {}, { pageSize: SHOW });

  useLiveEvents({
    "activity:created": (payload) => {
      if (payload?.workspaceId === workspace.id && payload.activity) feed.addLive(payload.activity);
    },
    // We were offline for a while, so entries may have been missed.
    "connection:restored": () => feed.reload(),
  });

  const shown = feed.items.slice(0, SHOW);

  return (
    <DashboardCard
      title="Recent activity"
      action={{ href: `/workspaces/${workspace.id}/activity`, label: "View all" }}
    >
      {feed.status === "loading" && (
        <div className="space-y-3" role="status" aria-live="polite">
          <div className="skeleton h-12 rounded-control" />
          <div className="skeleton h-12 rounded-control" />
          <span className="sr-only">Loading recent activity</span>
        </div>
      )}

      {/* Never show "nothing happened" when the real problem is a failed request. */}
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

      {feed.status === "ready" && shown.length === 0 && (
        <EmptyHint icon={ActivityIcon} title="Nothing has happened yet">
          Everything your team does in this workspace shows up here.
        </EmptyHint>
      )}

      {feed.status === "ready" && shown.length > 0 && (
        <ol>
          {shown.map((activity) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              workspaceId={workspace.id}
              userId={user.id}
              compact
            />
          ))}
        </ol>
      )}
    </DashboardCard>
  );
}