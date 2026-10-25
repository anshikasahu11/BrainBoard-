"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listSnippetsRequest } from "@/services/snippetService";

// Loads the snippet list for the current filters, and reloads when they change.
// reload(): fetch again QUIETLY. The cards stay on screen, and if the refresh fails
//           they stay too (used after saving, and for live updates).
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
  const quietRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    listSnippetsRequest(workspaceId, { q, language, tag })
      .then((data) => {
        if (cancelled) return;
        quietRef.current = false;
        setState({ status: "ready", snippets: data.snippets, total: data.total, error: "", key });
      })
      .catch((error) => {
        if (cancelled) return;
        // A background refresh that fails keeps what's on screen.
        setState((current) =>
          quietRef.current && current.status === "ready" && current.key === key
            ? current
            : { status: "error", snippets: [], total: 0, error: error.message, key }
        );
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, q, language, tag, key, attempt]);

  const reload = useCallback(() => {
    quietRef.current = true;
    setAttempt((n) => n + 1);
  }, []);

  const retry = useCallback(() => {
    quietRef.current = false;
    setState((current) => ({ ...current, status: "loading", error: "" }));
    setAttempt((n) => n + 1);
  }, []);

  const refreshing = state.status === "ready" && state.key !== key;

  return { ...state, refreshing, reload, retry };
}