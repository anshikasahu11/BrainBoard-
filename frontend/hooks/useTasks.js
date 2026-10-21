"use client";

import { useCallback, useEffect, useState } from "react";
import { listTasksRequest } from "@/services/taskService";

// Loads the board's tasks for the current filters, and reloads when they change.
// reload(): fetch again but keep the current cards on screen (used after saving).
// retry():  fetch again after an error.
// refreshing: true while the cards on screen belong to older filters.
// setTasks: lets drag and drop (Step 3) update the cards instantly.
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

  useEffect(() => {
    let cancelled = false;

    listTasksRequest(workspaceId, { q, priority, assignee })
      .then((data) => {
        if (!cancelled) {
          setState({ status: "ready", tasks: data.tasks, total: data.total, error: "", key });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ status: "error", tasks: [], total: 0, error: error.message, key });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, q, priority, assignee, key, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const retry = useCallback(() => {
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