"use client";

import "./globals.css";

// The last safety net: shown only if the app's outermost layer itself crashes. It has to bring
// its own <html> and <body>, because the normal ones are what crashed.
export default function GlobalError({ reset }) {
  return (
    <html lang="en">
      <body className="bg-void font-sans text-fg antialiased">
        <main role="alert" className="mx-auto max-w-xl px-6 py-24">
          <h1 className="text-4xl">BrainBoard hit a problem</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-fg-2">
            Something broke before the page could load. Your saved work is safe. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={reset}
            className="btn-primary mt-8 inline-flex items-center rounded-control px-5 py-2.5 text-sm"
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}