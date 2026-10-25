"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Loads something from the API and tracks loading, ready and error.
//   key:    a string that identifies WHAT is loaded. A new key loads again.
//   loader: a function that returns the request's promise.
// Returns { status: "loading" | "ready" | "error", data, error, reload, retry }.
//   reload(): fetch again QUIETLY. The current data stays on screen, and if the
//             refresh fails the old data stays too (it was right a moment ago).
//   retry():  fetch again after an error, showing the loading state.
export default function useLoad(key, loader) {
  const [state, setState] = useState({ key, status: "loading", data: null, error: "" });
  const [attempt, setAttempt] = useState(0);
  const quietRef = useRef(false);

  // Keep the newest loader in a ref, so the effect only restarts when the key changes.
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    let cancelled = false;

    loaderRef
      .current()
      .then((data) => {
        if (cancelled) return;
        quietRef.current = false;
        setState({ key, status: "ready", data, error: "" });
      })
      .catch((error) => {
        if (cancelled) return;
        setState((current) =>
          quietRef.current && current.key === key && current.status === "ready"
            ? current
            : { key, status: "error", data: null, error: error.message }
        );
      });

    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  const reload = useCallback(() => {
    quietRef.current = true;
    setAttempt((n) => n + 1);
  }, []);

  const retry = useCallback(() => {
    quietRef.current = false;
    setState((current) => ({ ...current, status: "loading", error: "" }));
    setAttempt((n) => n + 1);
  }, []);

  // Results that belong to a different key count as "still loading".
  const stale = state.key !== key;

  return {
    status: stale ? "loading" : state.status,
    data: stale ? null : state.data,
    error: state.error,
    reload,
    retry,
  };
}