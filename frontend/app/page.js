import AmbientBackground from "@/components/AmbientBackground";
import StatusCard from "@/components/StatusCard";
import Reveal from "@/components/Reveal";

export default function Home() {
  return (
    // data-motion sets this page's motion level. Landing = expressive.
    <main className="relative min-h-screen" data-motion="expressive">
      <AmbientBackground />

      <section className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-24">
        <Reveal level="expressive" delay={0.1}>
          <p className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-fg">
            <span className="size-1.5 rounded-full bg-ember-300" />
            Real-time workspace for dev teams
          </p>
        </Reveal>

        <Reveal level="expressive" delay={0.2}>
          <h1 className="text-glow font-display text-6xl leading-[1.04] tracking-tight md:text-7xl">
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
          <div className="mt-8 flex gap-3">
            <button className="btn-primary rounded-control px-5 py-2.5 text-sm">
              Create workspace
            </button>
            <button className="btn-ghost rounded-control px-5 py-2.5 text-sm">
              View demo
            </button>
          </div>
        </Reveal>

        <Reveal level="expressive" delay={0.75} className="mt-14">
          <StatusCard />
        </Reveal>
      </section>
    </main>
  );
}