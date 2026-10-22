"use client";

import { useEffect, useRef } from "react";
import useRealtime from "@/hooks/useRealtime";

// Listens for live events for as long as the component is on screen.
//   useLiveEvents({
//     "task:created": (payload) => { ... },
//     "connection:restored": () => { ... },
//   });
// The handlers can be written inline: the newest ones are always the ones called.
export default function useLiveEvents(handlers) {
  const { subscribe } = useRealtime();

  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  // Resubscribe only when the SET of events changes, not on every render.
  const names = Object.keys(handlers).sort().join("|");

  useEffect(() => {
    const stops = names
      .split("|")
      .filter(Boolean)
      .map((name) => subscribe(name, (payload) => latest.current[name]?.(payload)));

    return () => stops.forEach((stop) => stop());
  }, [names, subscribe]);
}