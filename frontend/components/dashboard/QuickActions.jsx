import Link from "next/link";
import { FilePlus, SquarePlus, FileCode } from "lucide-react";

// To switch a tile on in a later phase: add an `href` and delete `soon: true`.
const ACTIONS = [
  { key: "document", label: "New document", hint: "Write notes and docs", icon: FilePlus, soon: true },
  { key: "task", label: "New task", hint: "Plan work on a board", icon: SquarePlus, soon: true },
  { key: "snippet", label: "New snippet", hint: "Save reusable code", icon: FileCode, soon: true },
];

function Tile({ action }) {
  const Icon = action.icon;
  const inner = (
    <>
      <span className="icon-tile">
        <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{action.label}</span>
        <span className="block truncate text-[12px] text-fg-muted">{action.hint}</span>
      </span>
      {action.soon && <span className="soon-chip">Soon</span>}
    </>
  );

  // Built: a real link. Not built yet: inert, and skipped by the Tab key.
  if (action.soon || !action.href) {
    return (
      <div className="quick-tile quick-tile-soon" aria-disabled="true">
        {inner}
      </div>
    );
  }

  return (
    <Link href={action.href} className="quick-tile">
      {inner}
    </Link>
  );
}

export default function QuickActions() {
  return (
    <section aria-label="Quick actions">
      <ul className="grid gap-3 sm:grid-cols-3">
        {ACTIONS.map((action) => (
          <li key={action.key}>
            <Tile action={action} />
          </li>
        ))}
      </ul>
    </section>
  );
}