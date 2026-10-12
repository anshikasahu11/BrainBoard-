// Placeholder goals. Replace with measured numbers in Phase 15.
const stats = [
  { value: "99.9%", label: "Uptime target" },
  { value: "<100ms", label: "Live sync goal" },
  { value: "3 roles", label: "Access control" },
];

export default function Stats() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-28">
      <dl className="grid grid-cols-3 gap-4">
        {stats.map(({ value, label }) => (
          <div key={label} className="flex flex-col-reverse">
            <dt className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-2">
              {label}
            </dt>
            <dd className="text-glow font-display text-4xl text-ember-300 sm:text-5xl">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}