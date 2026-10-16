// Task statistics. The numbers arrive with the Tasks phase. Until then every
// value is a dash, never a zero: a zero would claim "you have no tasks", and
// we don't know that yet.
const STATS = ["To do", "In progress", "Review", "Done"];

export default function StatsRow() {
  return (
    <section aria-label="Task statistics">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATS.map((label) => (
          <div key={label} className="glass flex flex-col-reverse rounded-card p-4">
            <dt className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-2">
              {label}
            </dt>
            <dd className="font-display text-4xl leading-none text-fg-muted">
              <span aria-hidden="true">—</span>
              <span className="sr-only">Not available yet</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[12px] text-fg-muted">
        Task statistics appear here once tasks are available.
      </p>
    </section>
  );
}