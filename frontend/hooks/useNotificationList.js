"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useLiveEvents from "@/hooks/useLiveEvents";
import { loadedLimit, matchesFilters, mergePage, PAGE_SIZE } from "@/lib/notificationList";
import { addNotification, markAllItemsRead, markItemRead, removeItem } from "@/lib/notificationState";
import {
  deleteNotificationRequest,
  listNotificationsRequest,
  markAllReadRequest,
  markReadRequest,
} from "@/services/notificationService";

const HOLD = 500; // the most a list holds, so live arrivals can't grow it forever

// The full list of notifications, with filters, paging, and live updates.
//   unread:     only unread ones.   workspace: only this workspace's ("" = all of them).
//   onChanged:  called after something is read or dismissed, so the bell can refresh.
// Returns { status, items, hasMore, unreadCount, error, problem, loadingMore, reload, loadMore,
//           markRead, dismiss, markAllRead, clearProblem }.
export default function useNotificationList({ unread = false, workspace = "", onChanged } = {}) {
  const [state, setState] = useState({ status: "loading", items: [], nextCursor: null, unreadCount: 0, error: "" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [problem, setProblem] = useState("");

  const stateRef = useRef(state);
  const requestId = useRef(0); // changes whenever an older answer should be ignored
  const busyMore = useRef(false);
  const changed = useRef(onChanged);

  useEffect(() => {
    stateRef.current = state;
    changed.current = onChanged;
  });

  // quiet: refresh without a loading state, keeping as many as are already showing.
  const load = useCallback(
    async ({ quiet = false } = {}) => {
      const mine = ++requestId.current;

      if (!quiet) {
        setState({ status: "loading", items: [], nextCursor: null, unreadCount: stateRef.current.unreadCount, error: "" });
      }

      try {
        const data = await listNotificationsRequest({
          limit: quiet ? loadedLimit(stateRef.current.items.length) : PAGE_SIZE,
          unread,
          workspace,
        });
        if (mine !== requestId.current) return;

        setState({ status: "ready", items: data.notifications, nextCursor: data.nextCursor, unreadCount: data.unreadCount, error: "" });
      } catch (error) {
        if (mine !== requestId.current) return;

        // What's already on screen stays if a quiet refresh fails.
        setState((current) => (current.status === "ready" ? current : { ...current, status: "error", error: error.message }));
      }
    },
    [unread, workspace]
  );

  // Start over whenever the filters change.
  useEffect(() => {
    load();
  }, [load]);

  const reload = useCallback(() => load(), [load]);

  const loadMore = useCallback(async () => {
    const { nextCursor } = stateRef.current;
    if (!nextCursor || busyMore.current) return;

    busyMore.current = true;
    setLoadingMore(true);
    setProblem("");
    const mine = requestId.current;

    try {
      const data = await listNotificationsRequest({ limit: PAGE_SIZE, before: nextCursor, unread, workspace });
      if (mine !== requestId.current) return;

      setState((current) => ({
        ...current,
        items: mergePage(current.items, data.notifications),
        nextCursor: data.nextCursor,
        unreadCount: data.unreadCount,
      }));
    } catch (error) {
      if (mine === requestId.current) setProblem(error.message);
    } finally {
      busyMore.current = false;
      setLoadingMore(false);
    }
  }, [unread, workspace]);

  useLiveEvents({
    "notification:created": (payload) => {
      const incoming = payload?.notification;
      if (!incoming) return;

      setState((current) => {
        if (current.status !== "ready") return current;

        const unreadCount = Number.isFinite(payload.unreadCount) ? payload.unreadCount : current.unreadCount + 1;
        // One that doesn't fit the filters only changes the count.
        if (!matchesFilters(incoming, { unread, workspace })) return { ...current, unreadCount };

        return { ...current, items: addNotification(current.items, incoming, HOLD), unreadCount };
      });
    },

    // Another tab read or dismissed something.
    "notification:changed": () => load({ quiet: true }),

    // We were offline for a while, so events may have been missed.
    "connection:restored": () => load({ quiet: true }),
  });

  // Instant on screen, then confirmed by the server. If it says no, the screen goes back to the truth.
  const markRead = useCallback(
    async (id) => {
      const target = stateRef.current.items.find((item) => item.id === id);
      if (!target || target.read) return;

      setState((current) => ({
        ...current,
        items: markItemRead(current.items, id),
        unreadCount: Math.max(0, current.unreadCount - 1),
      }));

      try {
        const data = await markReadRequest(id);
        setState((current) => ({ ...current, unreadCount: data.unreadCount }));
      } catch (error) {
        // "Not found" means it's already gone (dismissed in another tab), which isn't worth a message.
        if (error.status !== 404) setProblem(error.message);
        load({ quiet: true });
      } finally {
        changed.current?.();
      }
    },
    [load]
  );

  const dismiss = useCallback(
    async (id) => {
      const target = stateRef.current.items.find((item) => item.id === id);
      if (!target) return;

      setProblem("");
      setState((current) => ({
        ...current,
        items: removeItem(current.items, id),
        unreadCount: target.read ? current.unreadCount : Math.max(0, current.unreadCount - 1),
      }));

      try {
        await deleteNotificationRequest(id);
      } catch (error) {
        if (error.status !== 404) setProblem(error.message);
        load({ quiet: true });
      } finally {
        changed.current?.();
      }
    },
    [load]
  );

  const markAllRead = useCallback(async () => {
    setProblem("");
    setState((current) => ({ ...current, items: markAllItemsRead(current.items), unreadCount: 0 }));

    try {
      const data = await markAllReadRequest();
      setState((current) => ({ ...current, unreadCount: data.unreadCount }));
    } catch (error) {
      setProblem(error.message);
      load({ quiet: true });
    } finally {
      changed.current?.();
    }
  }, [load]);

  const clearProblem = useCallback(() => setProblem(""), []);

  return {
    status: state.status,
    items: state.items,
    hasMore: Boolean(state.nextCursor),
    unreadCount: state.unreadCount,
    error: state.error,
    problem,
    loadingMore,
    reload,
    loadMore,
    markRead,
    dismiss,
    markAllRead,
    clearProblem,
  };
}