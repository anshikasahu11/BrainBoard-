"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listActivityRequest } from "@/services/activityService";

const PAGE_SIZE = 30;

// Removes repeats, keeping the first of each id.
function unique(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

// Loads a workspace's activity feed, a page at a time.
//   filters: { category, actor, target }. A new set of filters loads again.
// Returns:
//   status:      "loading" | "ready" | "error"
//   items:       the entries, newest first
//   hasMore / loadMore() / loadingMore / moreError: the next, older page
//   addLive(a):  put one new entry at the top (a live event)
//   addMany(l):  put several (newest first) at the top
//   reload():    fetch the first page again QUIETLY. The list stays on screen, and if the
//                refresh fails it stays too (used after a reconnect)
//   retry():     fetch again after an error
//   refreshing:  true while the list on screen belongs to older filters
//   filterKey:   a string that identifies the current filters
export default function useActivityFeed(workspaceId, filters) {
  const { category = "", actor = "", target = "" } = filters;
  const key = `${category}|${actor}|${target}`;

  const [state, setState] = useState({ status: "loading", items: [], cursor: null, error: "", key: "" });
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState("");

  const quietRef = useRef(false); // true while a background refresh is running
  const epochRef = useRef(0); // changes whenever the first page is fetched again

  useEffect(() => {
    let cancelled = false;
    epochRef.current += 1; // any "load more" still in flight now belongs to an old list

    listActivityRequest(workspaceId, { category, actor, target, limit: PAGE_SIZE })
      .then((data) => {
        if (cancelled) return;
        quietRef.current = false;
        setState({ status: "ready", items: data.activities, cursor: data.nextCursor, error: "", key });
      })
      .catch((error) => {
        if (cancelled) return;
        // A background refresh that fails keeps what's on screen.
        setState((current) =>
          quietRef.current && current.status === "ready" && current.key === key
            ? current
            : { status: "error", items: [], cursor: null, error: error.message, key }
        );
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, category, actor, target, key, attempt]);

  const reload = useCallback(() => {
    quietRef.current = true;
    setAttempt((n) => n + 1);
  }, []);

  const retry = useCallback(() => {
    quietRef.current = false;
    setState((current) => ({ ...current, status: "loading", error: "" }));
    setAttempt((n) => n + 1);
  }, []);

  async function loadMore() {
    if (loadingMore || !state.cursor || state.status !== "ready") return;

    const epoch = epochRef.current;
    setLoadingMore(true);
    setMoreError("");

    try {
      const data = await listActivityRequest(workspaceId, {
        category,
        actor,
        target,
        before: state.cursor,
        limit: PAGE_SIZE,
      });

      // The filters changed (or the feed reloaded) while this was loading: it's an old answer.
      if (epoch !== epochRef.current) return;

      setState((current) => ({
        ...current,
        items: unique([...current.items, ...data.activities]),
        cursor: data.nextCursor,
      }));
    } catch (error) {
      if (epoch === epochRef.current) setMoreError(error.message);
    } finally {
      setLoadingMore(false);
    }
  }

  // A live entry goes to the top. `fresh` makes it fade in once.
  const addLive = useCallback((activity) => {
    setState((current) =>
      current.status !== "ready" || current.items.some((item) => item.id === activity.id)
        ? current
        : { ...current, items: [{ ...activity, fresh: true }, ...current.items] }
    );
  }, []);

  const addMany = useCallback((activities) => {
    if (activities.length === 0) return;
    setState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            items: unique([...activities.map((activity) => ({ ...activity, fresh: true })), ...current.items]),
          }
    );
  }, []);

  return {
    status: state.status,
    items: state.items,
    error: state.error,
    hasMore: state.status === "ready" && state.cursor !== null,
    loadMore,
    loadingMore,
    moreError,
    addLive,
    addMany,
    reload,
    retry,
    refreshing: state.status === "ready" && state.key !== key,
    filterKey: key,
  };
}