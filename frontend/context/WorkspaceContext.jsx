"use client";

import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getWorkspaceRequest, listWorkspacesRequest } from "@/services/workspaceService";
import { clearLastWorkspace, setLastWorkspace } from "@/lib/lastWorkspace";

export const WorkspaceContext = createContext(null);

// Loads the current workspace (from the URL) once, and shares it with the
// sidebar and every page inside the workspace.
// status: "loading" | "ready" | "notfound" | "error"
export function WorkspaceProvider({ children }) {
  const { workspaceId } = useParams();

  const [state, setState] = useState({ status: "loading", workspace: null, error: "" });
  const [workspaces, setWorkspaces] = useState([]); // for the switcher
  const [attempt, setAttempt] = useState(0);

  // The current workspace.
  useEffect(() => {
    let cancelled = false;

    getWorkspaceRequest(workspaceId)
      .then((data) => {
        if (cancelled) return;
        setState({ status: "ready", workspace: data.workspace, error: "" });
        setLastWorkspace(data.workspace.id);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error.status === 404) {
          // Missing, deleted or not yours: the backend says the same thing for all three.
          clearLastWorkspace(workspaceId);
          setState({ status: "notfound", workspace: null, error: "" });
        } else {
          setState({ status: "error", workspace: null, error: error.message });
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
    setState({ status: "loading", workspace: null, error: "" });
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

  const value = useMemo(
    () => ({
      status: state.status,
      workspace: state.workspace,
      error: state.error,
      role: state.workspace?.role ?? null,
      workspaces,
      retry,
      patchWorkspace,
    }),
    [state, workspaces, retry, patchWorkspace]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}