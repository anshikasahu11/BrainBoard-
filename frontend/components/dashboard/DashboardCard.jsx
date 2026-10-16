import { useId } from "react";
import Link from "next/link";

// The frame every dashboard card shares: a small mono title on the left, and on
// the right either a "Soon" chip, a link, or a plain note.
// featured: gives the card a gradient hairline border (use at most one per screen).
export default function DashboardCard({
  title,
  soon = false,
  featured = false,
  action,
  meta,
  children,
}) {
  const headingId = useId();

  const content = (
    <section
      aria-labelledby={headingId}
      className={`h-full p-5 ${featured ? "dash-card-inner" : "glass rounded-card"}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={headingId} className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-2">
          {title}
        </h2>

        {soon ? (
          <span className="soon-chip">Soon</span>
        ) : action ? (
          <Link
            href={action.href}
            className="text-[12px] text-fg-2 transition-colors hover:text-ember-300"
          >
            {action.label}
          </Link>
        ) : meta ? (
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
            {meta}
          </span>
        ) : null}
      </div>

      {children}
    </section>
  );

  return featured ? <div className="gradient-border h-full">{content}</div> : content;
}

// What a card shows when it has nothing to list.
export function EmptyHint({ icon: Icon, title, children }) {
  return (
    <div className="flex gap-3">
      <span className="empty-icon">
        <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[14px]">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-fg-2">{children}</p>
      </div>
    </div>
  );
}