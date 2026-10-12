import Link from "next/link";
import Orb from "@/components/Orb";

export default function AiBand() {
  return (
    <section id="ai" className="mx-auto max-w-5xl scroll-mt-24 px-6 pb-28">
      {/* Outer wrapper draws the 1px spectrum border */}
      <div className="spectrum-border">
        <div className="ai-band">
          {/* Interior lighting behind the content */}
          <div className="ai-blob ai-blob-a" aria-hidden="true" />
          <div className="ai-blob ai-blob-b" aria-hidden="true" />

          <Orb size="96px" dots={false} className="relative shrink-0" />

          <div className="relative flex-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-2">
              AI assistant
            </p>
            <h2 className="text-glow mt-1 font-display text-3xl leading-[1.15] sm:text-4xl">
              Summarize, explain, rewrite.
            </h2>
            <p className="mt-2 max-w-md text-[13px] leading-relaxed text-fg-2">
              Select any doc or code block and let the assistant do the first draft.
            </p>
          </div>

          <Link
            href="/register"
            className="btn-ghost relative inline-flex shrink-0 items-center rounded-control px-5 py-2.5 text-sm"
          >
            Try the assistant
          </Link>
        </div>
      </div>
    </section>
  );
}