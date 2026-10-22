"use client";

import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import useAuth from "@/hooks/useAuth";
import useCoalescedReload from "@/hooks/useCoalescedReload";
import useLiveEvents from "@/hooks/useLiveEvents";
import useWorkspaceRoom from "@/hooks/useWorkspaceRoom";
import { getWorkspaceRequest, listWorkspacesRequest } from "@/services/workspaceService";
import { clearLastWorkspace, setLastWorkspace } from "@/lib/lastWorkspace";

export const WorkspaceContext = createContext(null);

// Loads the current workspace (from the URL) once, shares it with the sidebar and
// every page inside the workspace, and keeps it up to date from live events.
// status: "loading" | "ready" | "notfound" | "error"
// lostReason (when status is "notfound"): "removed" | "left" | "deleted" | null
export function WorkspaceProvider({ children }) {
  const { workspaceId } = useParams();
  const { user } = useAuth();

  const [state, setState] = useState({ status: "loading", workspace: null, error: "", reason: null });
  const [workspaces, setWorkspaces] = useState([]); // for the switcher
  const [attempt, setAttempt] = useState(0);

  // The current workspace.
  useEffect(() => {
    let cancelled = false;

    getWorkspaceRequest(workspaceId)
      .then((data) => {
        if (cancelled) return;
        setState({ status: "ready", workspace: data.workspace, error: "", reason: null });
        setLastWorkspace(data.workspace.id);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error.status === 404) {
          // Missing, deleted or not yours: the backend says the same thing for all three.
          clearLastWorkspace(workspaceId);
          setState({ status: "notfound", workspace: null, error: "", reason: null });
        } else {
          setState({ status: "error", workspace: null, error: error.message, reason: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, attempt]);

  // The list for the switcher. If it fails, the switcher just shows the current one.
  useEffect(() => {
    let cancelled = false;

    listWorkspacesRequest()
      .then((data) => {
        if (!cancelled) setWorkspaces(data.workspaces);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const retry = useCallback(() => {
    setState({ status: "loading", workspace: null, error: "", reason: null });
    setAttempt((n) => n + 1);
  }, []);

  // Merge changes (a rename, a new member count) without refetching.
  const patchWorkspace = useCallback(
    (changes) => {
      setState((current) =>
        current.workspace
          ? { ...current, workspace: { ...current.workspace, ...changes } }
          : current
      );
      setWorkspaces((list) => list.map((w) => (w.id === workspaceId ? { ...w, ...changes } : w)));
    },
    [workspaceId]
  );

  // ----- Live updates -----

  // Hear about this workspace once we know the person really is a member.
  useWorkspaceRoom(workspaceId, state.status === "ready");

  // Access is gone (removed, left, or the workspace was deleted). An explicit reason
  // is never replaced by a vaguer one that arrives a moment later.
  const lose = useCallback(
    (reason) => {
      clearLastWorkspace(workspaceId);
      setState((current) =>
        current.status === "notfound" && current.reason && !reason
          ? current
          : { status: "notfound", workspace: null, error: "", reason }
      );
    },
    [workspaceId]
  );

  // Fetch the workspace again, quietly, to pick up the exact member count and your role.
  const refreshQuietly = useCallback(async () => {
    try {
      const data = await getWorkspaceRequest(workspaceId);
      patchWorkspace(data.workspace);
    } catch (error) {
      if (error.status === 404) {
        clearLastWorkspace(workspaceId);
        setState((current) =>
          current.status === "ready"
            ? { status: "notfound", workspace: null, error: "", reason: null }
            : current
        );
      }
      // Any other problem: keep what's on screen. The next event or reconnect tries again.
    }
  }, [workspaceId, patchWorkspace]);

  const scheduleRefresh = useCoalescedReload(refreshQuietly);

  const isThis = (payload) => payload?.workspaceId === workspaceId;

  useLiveEvents({
    "workspace:updated": (payload) => {
      if (isThis(payload)) patchWorkspace({ name: payload.name, updatedAt: payload.updatedAt });
    },
    "workspace:deleted": (payload) => {
      if (isThis(payload)) lose("deleted");
    },
    "workspace:access-lost": (payload) => {
      if (isThis(payload)) {
        lose(payload.reason === "removed" || payload.reason === "left" ? payload.reason : null);
      }
    },
    // People joined or left: the server knows the exact count, so ask it.
    "member:added": (payload) => {
      if (isThis(payload)) scheduleRefresh();
    },
    "member:removed": (payload) => {
      if (isThis(payload)) scheduleRefresh();
    },
    // YOUR role changed: the buttons you're allowed to see change with it.
    "member:updated": (payload) => {
      if (isThis(payload) && payload.member?.id === user?.id) scheduleRefresh();
    },
    // We were offline for a while: anything could have changed.
    "connection:restored": () => scheduleRefresh(),
  });

  const value = useMemo(
    () => ({
      status: state.status,
      workspace: state.workspace,
      error: state.error,
      lostReason: state.reason,
      role: state.workspace?.role ?? null,
      workspaces,
      retry,
      patchWorkspace,
    }),
    [state, workspaces, retry, patchWorkspace]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}