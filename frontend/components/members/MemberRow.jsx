"use client";

import { UserMinus } from "lucide-react";
import PresenceAvatar from "@/components/app/PresenceAvatar";
import RoleBadge from "@/components/workspaces/RoleBadge";
import usePresence from "@/hooks/usePresence";
import useWorkspace from "@/hooks/useWorkspace";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatDate } from "@/lib/format";

// One person in the list.
// roleOptions: roles the viewer may switch this person to, or null for a plain badge.
// onRemove: provided only when the viewer is allowed to remove this person.
export default function MemberRow({ member, isSelf, roleOptions, busy, onRoleChange, onRemove }) {
  const { workspace } = useWorkspace();
  const { isOnline } = usePresence(workspace.id);

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0">
      <PresenceAvatar name={member.name} online={isOnline(member.id)} />

      <div className="min-w-0 flex-1 basis-48">
        <p className="flex items-center gap-2 truncate text-[14px]">
          <span className="truncate">{member.name}</span>
          {isSelf && (
            <span className="rounded-chip bg-white/10 px-1.5 py-0.5 text-[11px] text-fg-2">You</span>
          )}
        </p>
        <p className="truncate text-[12px] text-fg-muted">{member.email}</p>
        <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
          Joined {formatDate(member.joinedAt)}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {roleOptions ? (
          <>
            <label htmlFor={`role-${member.id}`} className="sr-only">
              Role for {member.name}
            </label>
            <select
              id={`role-${member.id}`}
              value={member.role}
              disabled={busy}
              onChange={(event) => onRoleChange(member, event.target.value)}
              className="input input-sm"
            >
              {roleOptions.map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value]}
                </option>
              ))}
            </select>
          </>
        ) : (
          <RoleBadge role={member.role} />
        )}

        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(member)}
            disabled={busy}
            aria-label={`Remove ${member.name}`}
            className="grid size-9 place-items-center rounded-control text-fg-2 transition-colors hover:bg-white/10 hover:text-danger disabled:opacity-50"
          >
            <UserMinus size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </li>
  );
}