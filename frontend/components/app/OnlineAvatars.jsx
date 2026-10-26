"use client";

import PresenceAvatar from "@/components/app/PresenceAvatar";
import usePresence from "@/hooks/usePresence";
import useRealtime from "@/hooks/useRealtime";
import useWorkspace from "@/hooks/useWorkspace";

const SHOW = 5;

// Who else is in this workspace right now. Shown in the sidebar.
export default function OnlineAvatars() {
  const { status, joined } = useRealtime();
  const { workspace } = useWorkspace();
  const { others } = usePresence(workspace.id);

  // Offline, or not in the workspace's room yet: we don't know who's here, so say nothing.
  if (status !== "connected" || !joined.includes(workspace.id)) return null;

  const shown = others.slice(0, SHOW);
  const extra = others.length - shown.length;

  return (
    <div className="px-1">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-2">
        {others.length === 0 ? "Only you here" : `${others.length} online`}
      </p>

      {others.length > 0 && (
        <ul className="presence-stack" aria-label="Teammates online">
          {shown.map((person) => (
            <li key={person.id}>
              <PresenceAvatar name={person.name} online label={`${person.name}, online`} />
            </li>
          ))}
          {extra > 0 && (
            <li className="presence-more" aria-label={`and ${extra} more online`}>
              +{extra}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}