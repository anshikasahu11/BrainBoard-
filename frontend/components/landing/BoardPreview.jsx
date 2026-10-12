import {
  LayoutDashboard,
  FileText,
  Kanban,
  Code,
  Circle,
  CircleDot,
  CircleCheck,
} from "lucide-react";

const nav = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Documents", icon: FileText },
  { label: "Tasks", icon: Kanban },
  { label: "Snippets", icon: Code },
];

function ColumnHeader({ icon: Icon, label, tone }) {
  return (
    <div className={`mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] ${tone}`}>
      <Icon size={13} strokeWidth={1.5} aria-hidden="true" />
      {label}
    </div>
  );
}

export default function BoardPreview() {
  return (
    <section id="product" className="mx-auto max-w-5xl scroll-mt-24 px-6 pb-28">
      {/* Decorative preview: hidden from screen readers */}
      <div className="glass flex gap-3.5 rounded-panel p-3.5" aria-hidden="true">
        {/* Mini sidebar (hidden on small screens) */}
        <div className="hidden w-44 shrink-0 flex-col gap-1 rounded-card bg-void/55 p-2.5 text-[12px] text-fg-2 md:flex">
          <div className="mb-1.5 px-2 font-mono text-[11px] uppercase tracking-[0.08em] text-fg">
            Acme Dev
          </div>
          {nav.map(({ label, icon: Icon, active }) => (
            <div
              key={label}
              className={
                active
                  ? "flex items-center gap-2 rounded-r-md border-l-2 border-ember-500 bg-linear-to-r from-ember-500/20 to-ember-500/0 px-2 py-1.5 text-fg"
                  : "flex items-center gap-2 px-2 py-1.5"
              }
            >
              <Icon size={14} strokeWidth={1.5} />
              {label}
            </div>
          ))}
        </div>

        {/* Columns */}
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
          {/* TO DO */}
          <div className="min-h-[160px] rounded-card bg-void/65 p-2.5">
            <ColumnHeader icon={Circle} label="To do" tone="text-fg-muted" />
            <div className="flex flex-col gap-2">
              <div className="board-card">
                <span>Write API docs</span>
                <span className="rounded-chip bg-ember-500/15 px-2 py-0.5 text-[11px] text-ember-300">
                  High
                </span>
              </div>

              {/* The card that moves on its own */}
              <div className="board-card board-mover">
                <span className="flex items-center gap-2">
                  <i className="pdot" />
                  Login API
                </span>
                <span className="grid size-[18px] place-items-center rounded-full bg-petrol-600 text-[10px] font-medium text-fg">
                  R
                </span>
              </div>
            </div>
          </div>

          {/* IN PROGRESS */}
          <div className="relative min-h-[160px] rounded-card bg-void/65 p-2.5">
            <ColumnHeader icon={CircleDot} label="In progress" tone="text-petrol-300" />
            <div className="land-glow" />
          </div>

          {/* DONE (hidden on the smallest screens) */}
          <div className="hidden min-h-[160px] rounded-card bg-void/65 p-2.5 sm:block">
            <ColumnHeader icon={CircleCheck} label="Done" tone="text-success" />
            <div className="board-card">
              <span>JWT middleware</span>
              <span className="rounded-chip bg-success/15 px-2 py-0.5 text-[11px] text-success">
                Merged
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}