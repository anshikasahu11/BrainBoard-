"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { runAiRequest } from "@/services/aiService";

const IDLE = { phase: "idle", result: null, meta: null, error: null };

// Runs ONE kind of AI request and keeps track of how it's going.
//   phase:  "idle" | "running" | "done" | "error"
//   result: the answer (done).  meta: provider, usage, quota and extras like "unchanged".
//   error:  what went wrong (error).
//   run(body): starts a request.  reset(): back to idle.
//   onDone: called when a request ends, whichever way. The screens use it to refresh the
//           "requests left" count.
// Closing the panel (leaving the screen) stops waiting. The server may still finish and count it.
export default function useAiAction(workspaceId, action, { onDone } = {}) {
  const [state, setState] = useState(IDLE);

  const token = useRef(0); // changes whenever an answer would no longer be wanted
  const controller = useRef(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(
    () => () => {
      token.current += 1;
      controller.current?.abort();
    },
    []
  );

  const run = useCallback(
    async (body) => {
      const mine = ++token.current;
      controller.current?.abort();
      const own = new AbortController();
      controller.current = own;

      setState({ phase: "running", result: null, meta: null, error: null });

      try {
        const data = await runAiRequest(workspaceId, action, body, own.signal);
        if (mine !== token.current) return;

        const { result, ...meta } = data;
        setState({ phase: "done", result, meta, error: null });
      } catch (error) {
        if (mine !== token.current) return;
        setState({ phase: "error", result: null, meta: null, error });
      } finally {
        if (mine === token.current) done.current?.();
      }
    },
    [workspaceId, action]
  );

  const reset = useCallback(() => {
    token.current += 1;
    controller.current?.abort();
    setState(IDLE);
  }, []);

  return { ...state, running: state.phase === "running", run, reset };
}