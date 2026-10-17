"use client";

import { useCallback, useEffect, useState } from "react";
import { listRecentDocumentsRequest } from "@/services/documentService";

// Loads the newest documents of a workspace.
// Returns { status: "loading" | "ready" | "error", documents, error, retry }.
export default function useRecentDocuments(workspaceId, limit = 5) {
  const [state, setState] = useState({ status: "loading", documents: [], error: "" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    listRecentDocumentsRequest(workspaceId, limit)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", documents: data.documents, error: "" });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", documents: [], error: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, limit, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading", documents: [], error: "" });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}