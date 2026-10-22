"use client";

import { useCallback, useEffect, useRef } from "react";

// Turns a burst of "something changed" signals into ONE reload.
//   reload: what to run.
//   paused: while true (for example during a drag), the reload is held back and
//           runs as soon as the pause ends.
// Returns trigger(): call it whenever a live event arrives.
export default function useCoalescedReload(reload, paused = false, delay = 150) {
  const timer = useRef(null);
  const waiting = useRef(false);
  const latest = useRef({ reload, paused });

  useEffect(() => {
    latest.current = { reload, paused };
  });

  const fire = useCallback(() => {
    timer.current = null;

    if (latest.current.paused) {
      waiting.current = true;
      return;
    }
    waiting.current = false;
    latest.current.reload();
  }, []);

  const trigger = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(fire, delay);
  }, [fire, delay]);

  // When a pause ends, run the reload that was held back.
  useEffect(() => {
    if (!paused && waiting.current) {
      waiting.current = false;
      trigger();
    }
  }, [paused, trigger]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return trigger;
}