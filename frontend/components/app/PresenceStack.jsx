"use client";

import usePresence from "@/hooks/usePresence";
import useAuth from "@/hooks/useAuth";
import useWorkspace from "@/hooks/useWorkspace";

const SHOW = 5;

// The avatars of the people who are online in this workspace right now.
export default function PresenceStack() {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const { users } = usePresence(workspace.id);

  // Nothing yet: we haven't joined the workspace's room (or we're offline).
  if (users.length === 0) return null;

  // You first, then the others in the order the server sent them.
  const ordered = [...users].sort((a, b) => (a.id === user.id ? -1 : b.id === user.id ? 1 : 0));
  const shown = ordered.slice(0, SHOW);
  const extra = ordered.length - shown.length;

  const label = (person) => (person.id === user.id ? `${person.name} (you)` : person.name);

  return (
    <div className="px-1">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
        Online · {users.length}
      </p>

      <ul className="flex items-center" aria-label="People online">
        {shown.map((person) => (
          <li key={person.id} className="-ml-1.5 first:ml-0">
            <span className="sr-only">{label(person)}</span>
            <span
              className="avatar avatar-sm ring-2 ring-void"
              title={label(person)}
              aria-hidden="true"
            >
              {person.name.charAt(0).toUpperCase()}
            </span>
          </li>
        ))}

        {extra > 0 && (
          <li className="-ml-1.5">
            <span
              className="grid h-[22px] min-w-[22px] place-items-center rounded-full bg-white/15 px-1 text-[11px] ring-2 ring-void"
              title={ordered
                .slice(SHOW)
                .map(label)
                .join(", ")}
            >
              +{extra}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}