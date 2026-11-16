import Link from "next/link";
import AmbientBackground from "@/components/AmbientBackground";

// Shown for any address that doesn't exist anywhere in the app.
export default function NotFound() {
  return (
    <div className="relative min-h-screen" data-motion="balanced">
      <AmbientBackground />

      <main className="mx-auto max-w-2xl px-6 py-24">
        <p className="eyebrow mb-4">
          <span className="size-1.5 rounded-full bg-ember-300" />
          Error 404
        </p>
        <h1 className="text-glow font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          This page doesn’t exist
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-fg-2">
          The address may have a typo, or the page may have been moved or deleted.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/workspaces" className="btn-primary inline-flex items-center rounded-control px-5 py-2.5 text-sm">
            Go to your workspaces
          </Link>
          <Link href="/" className="btn-ghost inline-flex items-center rounded-control px-5 py-2.5 text-sm">
            Back to the start
          </Link>
        </div>
      </main>
    </div>
  );
}