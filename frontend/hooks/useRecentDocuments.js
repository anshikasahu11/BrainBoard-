"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listRecentDocumentsRequest } from "@/services/documentService";

// Loads the newest documents of a workspace.
// Returns { status: "loading" | "ready" | "error", documents, error, reload, retry }.
//   reload(): fetch again QUIETLY. The list stays on screen, and if the refresh
//             fails it stays too (used for live updates).
//   retry():  fetch again after an error, showing the loading state.
export default function useRecentDocuments(workspaceId, limit = 5) {
  const [state, setState] = useState({ status: "loading", documents: [], error: "" });
  const [attempt, setAttempt] = useState(0);
  const quietRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    listRecentDocumentsRequest(workspaceId, limit)
      .then((data) => {
        if (cancelled) return;
        quietRef.current = false;
        setState({ status: "ready", documents: data.documents, error: "" });
      })
      .catch((error) => {
        if (cancelled) return;
        setState((current) =>
          quietRef.current && current.status === "ready"
            ? current
            : { status: "error", documents: [], error: error.message }
        );
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, limit, attempt]);

  const reload = useCallback(() => {
    quietRef.current = true;
    setAttempt((n) => n + 1);
  }, []);

  const retry = useCallback(() => {
    quietRef.current = false;
    setState({ status: "loading", documents: [], error: "" });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, reload, retry };
}