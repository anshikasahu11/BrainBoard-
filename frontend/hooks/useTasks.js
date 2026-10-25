"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listTasksRequest } from "@/services/taskService";

// Loads the board's tasks for the current filters, and reloads when they change.
// reload(): fetch again QUIETLY. The cards stay on screen, and if the refresh fails
//           they stay too (used after saving, and for live updates).
// retry():  fetch again after an error.
// refreshing: true while the cards on screen belong to older filters.
// setTasks: lets drag and drop update the cards instantly.
export default function useTasks(workspaceId, filters) {
  const { q, priority, assignee } = filters;
  const key = `${q}|${priority}|${assignee}`;

  const [state, setState] = useState({
    status: "loading",
    tasks: [],
    total: 0,
    error: "",
    key: "",
  });
  const [attempt, setAttempt] = useState(0);
  const quietRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    listTasksRequest(workspaceId, { q, priority, assignee })
      .then((data) => {
        if (cancelled) return;
        quietRef.current = false;
        setState({ status: "ready", tasks: data.tasks, total: data.total, error: "", key });
      })
      .catch((error) => {
        if (cancelled) return;
        // A background refresh that fails keeps what's on screen.
        setState((current) =>
          quietRef.current && current.status === "ready" && current.key === key
            ? current
            : { status: "error", tasks: [], total: 0, error: error.message, key }
        );
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, q, priority, assignee, key, attempt]);

  const reload = useCallback(() => {
    quietRef.current = true;
    setAttempt((n) => n + 1);
  }, []);

  const retry = useCallback(() => {
    quietRef.current = false;
    setState((current) => ({ ...current, status: "loading", error: "" }));
    setAttempt((n) => n + 1);
  }, []);

  const setTasks = useCallback((update) => {
    setState((current) => ({
      ...current,
      tasks: typeof update === "function" ? update(current.tasks) : update,
    }));
  }, []);

  const refreshing = state.status === "ready" && state.key !== key;

  return { ...state, refreshing, reload, retry, setTasks };
}