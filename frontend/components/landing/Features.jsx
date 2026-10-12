import { FileText, Kanban } from "lucide-react";

export default function Features() {
  return (
    <section id="features" className="mx-auto max-w-5xl scroll-mt-24 px-6 pb-28">
      <p className="eyebrow mb-5">
        <span className="size-1.5 rounded-full bg-ember-300" />
        Everything in one place
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="glass feature-card rounded-card p-5">
          <div className="icon-tile">
            <FileText size={18} strokeWidth={1.5} aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-[15px] font-medium">Documents</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-fg-2">
            Rich editor with live autosave and full version history.
          </p>
        </article>

        <article className="glass feature-card rounded-card p-5">
          <div className="icon-tile">
            <Kanban size={18} strokeWidth={1.5} aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-[15px] font-medium">Tasks</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-fg-2">
            Drag-and-drop Kanban with priorities and assignees.
          </p>
        </article>

        {/* Code card: cool (teal) tint, per the warm = work, cool = code rule */}
        <article className="glass-cool feature-card overflow-hidden rounded-card">
          <div className="code-head flex items-center justify-between px-5 py-3 text-[13px]">
            <h3 className="font-medium">Snippets</h3>
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
              TS
            </span>
          </div>
          <div
            className="px-5 pb-3 font-mono text-[11px] leading-[1.75] text-fg-2"
            aria-label="Example TypeScript snippet"
          >
            <div>
              <span className="text-[#ff8a63]">export const</span>{" "}
              <span className="text-petrol-300">verify</span> = (token) =&gt;
            </div>
            <div className="pl-4">
              jwt.<span className="text-petrol-300">verify</span>(token){" "}
              <span className="text-[#6f8590]">// jwt</span>
            </div>
          </div>
          <p className="px-5 pb-5 text-[13px] leading-relaxed text-fg-2">
            Syntax-highlighted code, one click to copy.
          </p>
        </article>
      </div>
    </section>
  );
}