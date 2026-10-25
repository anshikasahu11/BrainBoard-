"use client";

import { useEffect, useRef, useState } from "react";
import DashboardCard from "@/components/dashboard/DashboardCard";
import FormAlert from "@/components/auth/FormAlert";
import RoleBadge from "@/components/workspaces/RoleBadge";
import useCoalescedReload from "@/hooks/useCoalescedReload";
import useLiveEvents from "@/hooks/useLiveEvents";
import useWorkspace from "@/hooks/useWorkspace";
import { listMembersRequest } from "@/services/memberService";

const SHOW = 5;

export default function TeamCard() {
  const { workspace } = useWorkspace();
  const [state, setState] = useState({ status: "loading", members: [], error: "" });
  const [attempt, setAttempt] = useState(0);

  // True while a background (live) refresh is running: if it fails, the list stays.
  const quietRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    // The backend already sorts: owner first, then admins, then members.
    listMembersRequest(workspace.id)
      .then((data) => {
        if (cancelled) return;
        quietRef.current = false;
        setState({ status: "ready", members: data.members, error: "" });
      })
      .catch((error) => {
        if (cancelled) return;
        setState((current) =>
          quietRef.current && current.status === "ready"
            ? current
            : { status: "error", members: [], error: error.message }
        );
      });

    return () => {
      cancelled = true;
    };
  }, [workspace.id, attempt]);

  // Live: people joined, left or changed role.
  const liveReload = useCoalescedReload(() => {
    quietRef.current = true;
    setAttempt((n) => n + 1);
  });
  const isThis = (payload) => payload?.workspaceId === workspace.id;

  useLiveEvents({
    "member:added": (payload) => isThis(payload) && liveReload(),
    "member:updated": (payload) => isThis(payload) && liveReload(),
    "member:removed": (payload) => isThis(payload) && liveReload(),
    // We were offline for a while, so events may have been missed.
    "connection:restored": () => liveReload(),
  });

  function retry() {
    quietRef.current = false;
    setState({ status: "loading", members: [], error: "" });
    setAttempt((n) => n + 1);
  }

  const shown = state.members.slice(0, SHOW);
  const extra = state.members.length - shown.length;

  return (
    <DashboardCard
      title="Team"
      action={{ href: `/workspaces/${workspace.id}/members`, label: "View all" }}
    >
      {state.status === "loading" && (
        <div className="space-y-3" role="status" aria-live="polite">
          <div className="skeleton h-9 rounded-control" />
          <div className="skeleton h-9 rounded-control" />
          <span className="sr-only">Loading team</span>
        </div>
      )}

      {state.status === "error" && (
        <div className="space-y-3">
          <FormAlert message={state.error} />
          <button
            type="button"
            onClick={retry}
            className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
          >
            Try again
          </button>
        </div>
      )}

      {state.status === "ready" && (
        <>
          <ul>
            {shown.map((member) => (
              <li
                key={member.id}
                className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0"
              >
                <span className="avatar" aria-hidden="true">
                  {member.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px]">{member.name}</span>
                <RoleBadge role={member.role} />
              </li>
            ))}
          </ul>
          {extra > 0 && <p className="mt-3 text-[12px] text-fg-muted">+{extra} more</p>}
        </>
      )}
    </DashboardCard>
  );
}