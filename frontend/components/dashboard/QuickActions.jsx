"use client";

import Link from "next/link";
import { FilePlus, FileCode, Loader2, SquarePlus } from "lucide-react";

// A tile has one of three states:
//   onClick  a live button (runs an action)
//   href     a live link
//   neither  not built yet: dimmed, inert, skipped by the Tab key

function Tile({ action }) {
  const Icon = action.icon;

  const inner = (
    <>
      <span className="icon-tile">
        {action.busy ? (
          <Loader2 size={18} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
        ) : (
          <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">
          {action.busy ? "Creating…" : action.label}
        </span>
        <span className="block truncate text-[12px] text-fg-muted">{action.hint}</span>
      </span>
      {action.soon && <span className="soon-chip">Soon</span>}
    </>
  );

  if (action.onClick) {
    return (
      <button type="button" onClick={action.onClick} disabled={action.busy} className="quick-tile">
        {inner}
      </button>
    );
  }

  if (action.href && !action.soon) {
    return (
      <Link href={action.href} className="quick-tile">
        {inner}
      </Link>
    );
  }

  return (
    <div className="quick-tile quick-tile-soon" aria-disabled="true">
      {inner}
    </div>
  );
}

export default function QuickActions({ onCreateDocument, creatingDocument }) {
  // To switch a tile on in a later phase: give it an onClick or href and drop `soon`.
  const actions = [
    {
      key: "document",
      label: "New document",
      hint: "Write notes and docs",
      icon: FilePlus,
      onClick: onCreateDocument,
      busy: creatingDocument,
    },
    { key: "task", label: "New task", hint: "Plan work on a board", icon: SquarePlus, soon: true },
    { key: "snippet", label: "New snippet", hint: "Save reusable code", icon: FileCode, soon: true },
  ];

  return (
    <section aria-label="Quick actions">
      <ul className="grid gap-3 sm:grid-cols-3">
        {actions.map((action) => (
          <li key={action.key}>
            <Tile action={action} />
          </li>
        ))}
      </ul>
    </section>
  );
}