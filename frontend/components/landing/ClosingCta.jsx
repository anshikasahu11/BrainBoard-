import Link from "next/link";

export default function ClosingCta() {
  return (
    <section className="relative px-6 pb-32 pt-8 text-center">
      {/* Soft dark scrim keeps the heading readable over the bright light */}
      <div
        className="scrim pointer-events-none absolute left-1/2 top-0 h-full w-[min(90vw,760px)] -translate-x-1/2"
        aria-hidden="true"
      />

      <div className="relative">
        <h2 className="text-glow mx-auto max-w-2xl font-display text-4xl leading-[1.1] sm:text-5xl">
          Give your team one place to think.
        </h2>
        <Link
          href="/register"
          className="btn-light mt-8 inline-flex items-center rounded-control px-6 py-3 text-sm"
        >
          Create workspace
        </Link>
      </div>
    </section>
  );
}