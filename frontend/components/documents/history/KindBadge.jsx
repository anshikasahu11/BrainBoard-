import { kindInfo } from "@/lib/versions";

// An icon plus a word, so the kind of version never depends on colour alone.
export default function KindBadge({ kind }) {
  const info = kindInfo(kind);
  const Icon = info.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-chip px-1.5 py-0.5 text-[11px] ${info.classes}`}
    >
      <Icon size={11} strokeWidth={2} aria-hidden="true" />
      {info.label}
    </span>
  );
}