"use client";

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import useAuth from "@/hooks/useAuth";
import { API_URL } from "@/lib/api";
import { clearToken, getToken } from "@/lib/authStorage";
import { setSocketId } from "@/lib/socketId";

export const RealtimeContext = createContext(null);

// If the server refuses a connection for one of these reasons, the login itself is no good.
const AUTH_ERRORS = new Set([
  "Authentication required",
  "Invalid or expired token",
  "This account no longer exists",
]);

// The live connection. It opens while you're signed in and closes when you sign out.
//   status:  "connecting" (the first time) | "connected" | "disconnected"
//   joined:  the ids of the workspaces whose room this tab is in right now
//   subscribe(event, handler): listen for an event; returns a function that stops listening
//   joinWorkspace(id): hear about a workspace; returns a function that stops
//
// Besides the server's events, it announces one of its own:
//   "connection:restored"  the connection came back after a drop, so anything could have
//                          been missed and screens should reload.
export function RealtimeProvider({ children }) {
  const { status: authStatus } = useAuth();
  const authenticated = authStatus === "authenticated";

  const [status, setStatus] = useState("connecting");
  const [joined, setJoined] = useState([]);

  const socketRef = useRef(null);
  const listenersRef = useRef(new Map()); // event name -> set of handlers
  const roomsRef = useRef(new Map()); // workspace id -> how many components want it

  // Hands an event to everything listening for it. One broken handler can't stop the others.
  const dispatch = useCallback((event, payload) => {
    listenersRef.current.get(event)?.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`A handler for "${event}" failed:`, error);
      }
    });
  }, []);

  // Asks the server to let this tab hear about a workspace.
  const requestJoin = useCallback(
    function request(workspaceId) {
      const socket = socketRef.current;
      if (!socket?.connected) return; // it's asked again when the connection (re)opens

      socket.timeout(5000).emit("workspace:join", workspaceId, (error, reply) => {
        if (!roomsRef.current.has(workspaceId)) return; // we left in the meantime

        if (!error && reply?.ok) {
          setJoined((list) => (list.includes(workspaceId) ? list : [...list, workspaceId]));
          return;
        }

        // Not a member (any more): treat it as lost access.
        if (!error && reply?.error === "Workspace not found") {
          dispatch("workspace:access-lost", { workspaceId, reason: "unknown" });
          return;
        }

        // No answer, or "slow down": try again shortly.
        setTimeout(() => {
          if (roomsRef.current.has(workspaceId)) request(workspaceId);
        }, 3000);
      });
    },
    [dispatch]
  );

  // The connection itself.
  useEffect(() => {
    if (!authenticated) return;

    let stopped = false;
    let hasConnected = false;
    const timers = new Set();
    const later = (fn, ms) => {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
    };

    const socket = io(API_URL, {
      // A function, so every (re)connection sends the CURRENT token.
      auth: (done) => done({ token: getToken() }),
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("connected");
      setSocketId(socket.id);

      // The server forgot our rooms when we dropped. Ask for them all again.
      for (const workspaceId of roomsRef.current.keys()) requestJoin(workspaceId);

      // Anything that happened while we were away is lost: tell screens to reload.
      if (hasConnected) dispatch("connection:restored", {});
      hasConnected = true;
    });

    socket.on("disconnect", (reason) => {
      setStatus("disconnected");
      setSocketId(null);
      setJoined([]);

      // The server closed the connection (for example, because the login expired).
      // Reconnecting checks the login again: still good, we're back; not good, we're signed out.
      if (reason === "io server disconnect" && !stopped) later(() => socket.connect(), 1000);
    });

    socket.on("connect_error", (error) => {
      if (stopped) return;

      if (AUTH_ERRORS.has(error.message)) {
        // The login is no good: the session is over.
        clearToken();
        window.dispatchEvent(new Event("auth:logout"));
        return;
      }

      setStatus("disconnected");
      // When the server itself refused the connection, the library doesn't retry. Do it ourselves.
      if (!socket.active) later(() => socket.connect(), 5000);
    });

    socket.onAny((event, payload) => dispatch(event, payload));

    return () => {
      stopped = true;
      timers.forEach(clearTimeout);
      socket.close();
      socketRef.current = null;
      setSocketId(null);
      setStatus("connecting");
      setJoined([]);
    };
  }, [authenticated, dispatch, requestJoin]);

  const subscribe = useCallback((event, handler) => {
    const map = listenersRef.current;
    if (!map.has(event)) map.set(event, new Set());
    map.get(event).add(handler);

    return () => {
      map.get(event)?.delete(handler);
    };
  }, []);

  const joinWorkspace = useCallback(
    (workspaceId) => {
      const rooms = roomsRef.current;
      rooms.set(workspaceId, (rooms.get(workspaceId) ?? 0) + 1);
      if (rooms.get(workspaceId) === 1) requestJoin(workspaceId);

      return () => {
        const remaining = (rooms.get(workspaceId) ?? 1) - 1;
        if (remaining > 0) {
          rooms.set(workspaceId, remaining);
          return;
        }

        rooms.delete(workspaceId);
        const socket = socketRef.current;
        // If we're offline the server has already forgotten the room.
        if (socket?.connected) socket.emit("workspace:leave", workspaceId);
        setJoined((list) => list.filter((id) => id !== workspaceId));
      };
    },
    [requestJoin]
  );

  const value = useMemo(
    () => ({ status, joined, subscribe, joinWorkspace }),
    [status, joined, subscribe, joinWorkspace]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}