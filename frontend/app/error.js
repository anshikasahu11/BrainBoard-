"use client";

import { useEffect } from "react";
import Link from "next/link";
import AmbientBackground from "@/components/AmbientBackground";

// Shown when something crashes while a page is being drawn, so a bug never means a blank white page.
// The details are hidden on purpose. A reference code is shown, which helps us find it in the logs.
export default function ErrorPage({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="relative min-h-screen" data-motion="balanced">
      <AmbientBackground />

      <main role="alert" className="mx-auto max-w-2xl px-6 py-24">
        <p className="eyebrow mb-4">
          <span className="size-1.5 rounded-full bg-ember-300" />
          Something went wrong
        </p>
        <h1 className="text-glow font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          That didn’t work
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-fg-2">
          Something unexpected broke on this page. Your work is safe: anything you’d saved is still saved.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="btn-primary inline-flex items-center rounded-control px-5 py-2.5 text-sm"
          >
            Try again
          </button>
          <Link href="/workspaces" className="btn-ghost inline-flex items-center rounded-control px-5 py-2.5 text-sm">
            Go to your workspaces
          </Link>
        </div>

        {error?.digest && (
          <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
            Reference: {error.digest}
          </p>
        )}
      </main>
    </div>
  );
}