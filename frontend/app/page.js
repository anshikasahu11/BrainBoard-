import AmbientBackground from "@/components/AmbientBackground";
import StatusCard from "@/components/StatusCard";

export default function Home() {
  return (
    <main className="relative min-h-screen">
      <AmbientBackground />

      <section className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-24">
        <p className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-fg">
  <span className="size-1.5 rounded-full bg-ember-300" />
  Real-time workspace for dev teams
</p>

        <h1 className="text-glow font-display text-6xl leading-[1.04] tracking-tight md:text-7xl">
          Think together.
          <br />
          Ship faster.
        </h1>

        <p className="text-glow mt-5 max-w-md text-[15px] leading-relaxed text-fg-2">
          Docs, tasks and code in one shared workspace, synced live across your team.
        </p>

        <div className="mt-8 flex gap-3">
          <button className="btn-primary rounded-control px-5 py-2.5 text-sm">
            Create workspace
          </button>
          <button className="btn-ghost rounded-control px-5 py-2.5 text-sm">View demo</button>
        </div>

        <div className="mt-14">
          <StatusCard />
        </div>
      </section>
    </main>
  );
}