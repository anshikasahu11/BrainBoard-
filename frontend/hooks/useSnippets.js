"use client";

import { useCallback, useEffect, useState } from "react";
import { listSnippetsRequest } from "@/services/snippetService";

// Loads the snippet list for the current filters, and reloads when they change.
// reload(): fetch again but keep the current cards on screen (used after saving).
// retry():  fetch again after an error.
// refreshing: true while the cards on screen belong to older filters.
export default function useSnippets(workspaceId, filters) {
  const { q, language, tag } = filters;
  const key = `${q}|${language}|${tag}`;

  const [state, setState] = useState({
    status: "loading",
    snippets: [],
    total: 0,
    error: "",
    key: "",
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    listSnippetsRequest(workspaceId, { q, language, tag })
      .then((data) => {
        if (!cancelled) {
          setState({ status: "ready", snippets: data.snippets, total: data.total, error: "", key });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ status: "error", snippets: [], total: 0, error: error.message, key });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, q, language, tag, key, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const retry = useCallback(() => {
    setState((current) => ({ ...current, status: "loading", error: "" }));
    setAttempt((n) => n + 1);
  }, []);

  const refreshing = state.status === "ready" && state.key !== key;

  return { ...state, refreshing, reload, retry };
}