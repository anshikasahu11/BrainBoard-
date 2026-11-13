"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import useAuth from "@/hooks/useAuth";
import useLiveEvents from "@/hooks/useLiveEvents";
import { addNotification, markAllItemsRead, markItemRead } from "@/lib/notificationState";
import { notificationMessage } from "@/lib/notificationText";
import { browserTimeZone, needsSync, readMarker, writeMarker } from "@/lib/timeZone";
import {
  listNotificationsRequest,
  markAllReadRequest,
  markReadRequest,
  setTimeZoneRequest,
} from "@/services/notificationService";

const LIST_SIZE = 15; // how many the dropdown loads
const KEEP = 30; // how many it holds, so live arrivals don't push the list past this
const STALE_MS = 30_000; // coming back to the tab after this long checks for anything missed

const NotificationsContext = createContext(null);

// Holds the signed-in person's notifications for the whole workspace shell, so the bell in the
// sidebar and the bell in the top bar always agree. It listens for live events, keeps the badge
// number the SERVER reports (which covers every workspace), and tells the server this browser's
// time zone so reminders use the person's own "tomorrow".
export function NotificationsProvider({ children }) {
  const { user } = useAuth();

  const [state, setState] = useState({ status: "loading", items: [], unreadCount: 0, error: "" });
  const [actionError, setActionError] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const requestId = useRef(0); // changes whenever an older answer should be ignored
  const lastLoaded = useRef(0);
  const itemsRef = useRef([]);
  const announceTimer = useRef(null);

  useEffect(() => {
    itemsRef.current = state.items;
  });

  useEffect(() => () => clearTimeout(announceTimer.current), []);

  // quiet: refresh without showing a loading state, and without an error if it fails
  // (what's already on screen stays).
  const load = useCallback(async ({ quiet = false } = {}) => {
    const mine = ++requestId.current;

    if (!quiet) {
      setState((current) => (current.status === "ready" ? current : { ...current, status: "loading", error: "" }));
    }

    try {
      const data = await listNotificationsRequest({ limit: LIST_SIZE });
      if (mine !== requestId.current) return;

      lastLoaded.current = Date.now();
      setState({ status: "ready", items: data.notifications, unreadCount: data.unreadCount, error: "" });
    } catch (error) {
      if (mine !== requestId.current) return;

      setState((current) =>
        current.status === "ready" ? current : { ...current, status: "error", error: error.message }
      );
    }
  }, []);

  const reload = useCallback(() => load(), [load]);
  const refresh = useCallback(() => load({ quiet: true }), [load]);

  useEffect(() => {
    load();
  }, [load, user.id]);

  // Tell the server this browser's time zone, once per person per browser, and only when it changes.
  useEffect(() => {
    const zone = browserTimeZone();
    if (!zone) return;

    let storage = null;
    try {
      storage = window.localStorage;
    } catch {
      // Blocked storage just means it's sent again next time.
    }

    if (!needsSync(storage ? readMarker(storage, user.id) : null, zone)) return;

    setTimeZoneRequest(zone)
      .then(() => {
        if (storage) writeMarker(storage, user.id, zone);
      })
      .catch(() => {
        // Not worth bothering anyone: it will be tried again next time.
      });
  }, [user.id]);

  // Coming back to this tab after a while: check for anything missed.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "visible" && Date.now() - lastLoaded.current > STALE_MS) {
        load({ quiet: true });
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [load]);

  // Said once, politely, by one hidden area (there are two bells, but only one of these).
  const announce = useCallback((text) => {
    clearTimeout(announceTimer.current);
    setAnnouncement("");
    announceTimer.current = setTimeout(() => setAnnouncement(text), 80);
  }, []);

  useLiveEvents({
    "notification:created": (payload) => {
      const incoming = payload?.notification;
      if (!incoming) return;

      setState((current) => ({
        ...current,
        items: addNotification(current.items, incoming, KEEP),
        unreadCount: Number.isFinite(payload.unreadCount) ? payload.unreadCount : current.unreadCount + 1,
      }));
      announce(`New notification: ${notificationMessage(incoming).plain}`);
    },

    // Another tab of this person read or dismissed something.
    "notification:changed": (payload) => {
      if (Number.isFinite(payload?.unreadCount)) {
        setState((current) => ({ ...current, unreadCount: payload.unreadCount }));
      }
      load({ quiet: true });
    },

    // We were offline for a while, so events may have been missed.
    "connection:restored": () => load({ quiet: true }),
  });

  // Instant on screen, then confirmed by the server. If the server says no, the screen goes back to the truth.
  const markRead = useCallback(
    async (id) => {
      const target = itemsRef.current.find((item) => item.id === id);
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
        // 404 means it's already gone (dismissed in another tab), which isn't worth a message.
        if (error.status !== 404) setActionError(error.message);
        load({ quiet: true });
      }
    },
    [load]
  );

  const markAllRead = useCallback(async () => {
    setActionError("");
    setState((current) => ({ ...current, items: markAllItemsRead(current.items), unreadCount: 0 }));

    try {
      const data = await markAllReadRequest();
      setState((current) => ({ ...current, unreadCount: data.unreadCount }));
    } catch (error) {
      setActionError(error.message);
      load({ quiet: true });
    }
  }, [load]);

  const clearActionError = useCallback(() => setActionError(""), []);

  const value = useMemo(
    () => ({
      status: state.status,
      items: state.items,
      unreadCount: state.unreadCount,
      error: state.error,
      actionError,
      reload,
      refresh,
      markRead,
      markAllRead,
      clearActionError,
    }),
    [state, actionError, reload, refresh, markRead, markAllRead, clearActionError]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      {/* The one place new arrivals are announced to screen readers. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error("useNotifications must be used inside a NotificationsProvider");
  return context;
}