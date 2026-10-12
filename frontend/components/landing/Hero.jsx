import Link from "next/link";
import Reveal from "@/components/Reveal";
import Orb from "@/components/Orb";

export default function Hero() {
  return (
        <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-20 md:grid-cols-[1.25fr_1fr] md:pt-28 lg:pt-36">
      {/* Left column: text */}
      <div className="relative">
        {/* Soft dark scrim keeps text readable where the light is brightest */}
        <div
          className="scrim pointer-events-none absolute -left-16 -top-10 h-[130%] w-[140%]"
          aria-hidden="true"
        />

        <div className="relative">
          <Reveal level="expressive" delay={0.1}>
            <p className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-fg">
              <span className="size-1.5 rounded-full bg-ember-300" />
              Real-time workspace for dev teams
            </p>
          </Reveal>

          <Reveal level="expressive" delay={0.2}>
            <h1 className="text-glow font-display text-5xl leading-[1.04] tracking-tight sm:text-6xl md:text-7xl">
              Think together.
              <br />
              Ship faster.
            </h1>
          </Reveal>

          <Reveal level="expressive" delay={0.4}>
            <p className="text-glow mt-5 max-w-md text-[15px] leading-relaxed text-fg-2">
              Docs, tasks and code in one shared workspace, synced live across your team.
            </p>
          </Reveal>

          <Reveal level="expressive" delay={0.55}>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="btn-primary inline-flex items-center rounded-control px-5 py-2.5 text-sm"
              >
                Create workspace
              </Link>
              <Link
                href="#product"
                className="btn-ghost inline-flex items-center rounded-control px-5 py-2.5 text-sm"
              >
                View demo
              </Link>
            </div>
          </Reveal>
        </div>
      </div>

      {/* Right column: reserved for the AI orb (Step 2) */}
            {/* Right column: the AI orb */}
      <div className="flex items-center justify-center md:justify-end md:pr-6">
        <Reveal level="expressive" delay={0.9}>
          <Orb />
        </Reveal>
      </div>
    </section>
  );
}