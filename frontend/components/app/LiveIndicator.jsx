"use client";

import useRealtime from "@/hooks/useRealtime";
import useWorkspace from "@/hooks/useWorkspace";

const VIEWS = {
  live: { label: "Live", dot: "bg-success" },
  connecting: { label: "Connecting…", dot: "bg-amber animate-pulse" },
  offline: { label: "Offline", dot: "bg-danger" },
};

// Whether teammates' changes will appear by themselves. The word always says it,
// so the colour is never the only signal.
export default function LiveIndicator({ compact = false }) {
  const { status, joined } = useRealtime();
  const { workspace } = useWorkspace();

  // "Live" means connected AND in this workspace's room.
  let state = "connecting";
  if (status === "connected") state = joined.includes(workspace.id) ? "live" : "connecting";
  if (status === "disconnected") state = "offline";

  const view = VIEWS[state];

  return (
    <div role="status" aria-live="polite" className="px-1">
      <p className="flex items-center gap-2">
        <span className={`size-2 shrink-0 rounded-full ${view.dot}`} aria-hidden="true" />
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-2">
          {view.label}
        </span>
      </p>
      {!compact && state === "offline" && (
        <p className="mt-1 text-[12px] leading-snug text-fg-muted">
          Reconnecting. Teammates’ changes won’t appear until you’re back.
        </p>
      )}
    </div>
  );
}