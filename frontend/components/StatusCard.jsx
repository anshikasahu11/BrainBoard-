"use client";

import { useEffect, useState } from "react";
import { Server, Database, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";

function StatusRow({ icon: Icon, label, value, tone }) {
  const colors = {
    ok: "text-success",
    error: "text-danger",
    loading: "text-fg-muted",
  };
  return (
    <div className="flex items-center justify-between border-t border-line py-3 first:border-t-0">
      <span className="flex items-center gap-2.5 text-sm text-fg-2">
        <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
        {label}
      </span>
      <span className={`font-mono text-xs uppercase tracking-[0.08em] ${colors[tone]}`}>
        {value}
      </span>
    </div>
  );
}

export default function StatusCard() {
  const [state, setState] = useState({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/health")
      .then((data) => !cancelled && setState({ status: "ok", data }))
      .catch(
        (err) => !cancelled && setState({ status: "error", error: err.message })
      );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function retry() {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  const apiTone = state.status === "ok" ? "ok" : state.status === "error" ? "error" : "loading";
  const apiValue =
    state.status === "ok" ? "Online" : state.status === "error" ? "Unreachable" : "Checking";

  const dbConnected = state.status === "ok" && state.data.database === "connected";
  const dbTone = state.status === "loading" ? "loading" : dbConnected ? "ok" : "error";
  const dbValue =
    state.status === "loading" ? "Checking" : dbConnected ? "Connected" : "Unavailable";

  return (
    <div className="glass w-full max-w-md rounded-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
          System status
        </span>
        <button
          onClick={retry}
          aria-label="Check again"
          className="rounded-control p-1.5 text-fg-2 transition hover:bg-white/10 hover:text-fg"
        >
          <RefreshCw size={14} strokeWidth={1.5} />
        </button>
      </div>

      <StatusRow icon={Server} label="API server" value={apiValue} tone={apiTone} />
      <StatusRow icon={Database} label="MongoDB Atlas" value={dbValue} tone={dbTone} />

      {state.status === "error" && (
        <p className="mt-3 text-xs text-fg-muted">
          Couldn&apos;t reach the backend. Check that it&apos;s running on port 5000.
        </p>
      )}
    </div>
  );
}