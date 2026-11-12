"use client";

import { useCallback, useEffect, useState } from "react";
import { searchWorkspaceRequest } from "@/services/searchService";

// Runs a search whenever the query changes. Only the LATEST answer is ever used, so a slow
// reply to an older search can never replace a newer one.
//   enabled: false while the query is too short to search
// Returns { status: "idle" | "loading" | "ready" | "error", data, error, retry }.
//   data: the newest answer. While a newer search is loading it still holds the PREVIOUS
//         answer (data.query says which search it belongs to), so the list doesn't blank out.
export default function useWorkspaceSearch(workspaceId, query, enabled) {
  const key = `${workspaceId}|${query}`;

  const [state, setState] = useState({ key: "", status: "idle", data: null, error: "" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    searchWorkspaceRequest(workspaceId, query)
      .then((data) => {
        if (!cancelled) setState({ key, status: "ready", data, error: "" });
      })
      .catch((error) => {
        // After a failure, the old results would be misleading, so they're dropped.
        if (!cancelled) setState({ key, status: "error", data: null, error: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, query, enabled, key, attempt]);

  const retry = useCallback(() => {
    setState((current) => ({ ...current, key: "" })); // back to "loading"
    setAttempt((n) => n + 1);
  }, []);

  if (!enabled) return { status: "idle", data: null, error: "", retry };

  // An answer that belongs to an earlier search counts as "still loading".
  const current = state.key === key;
  return {
    status: current ? state.status : "loading",
    data: state.data,
    error: current && state.status === "error" ? state.error : "",
    retry,
  };
}