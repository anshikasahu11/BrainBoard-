"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Menu, X } from "lucide-react";
import AmbientBackground from "@/components/AmbientBackground";
import FullScreenLoader from "@/components/ui/FullScreenLoader";
import FormAlert from "@/components/auth/FormAlert";
import Sidebar from "@/components/app/Sidebar";
import Reveal from "@/components/Reveal";
import useWorkspace from "@/hooks/useWorkspace";

// The background and motion level shared by every state below.
function Frame({ children }) {
  return (
    // App pages use the balanced motion level
    <div className="relative min-h-screen" data-motion="balanced">
      <AmbientBackground />
      {children}
    </div>
  );
}

export default function AppShell({ children }) {
  const { status, workspace, error, retry } = useWorkspace();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeButtonRef = useRef(null);

  // While the mobile drawer is open: Esc closes it, the page behind can't
  // scroll, and focus moves to the close button.
  useEffect(() => {
    if (!drawerOpen) return;

    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  if (status === "loading") {
    return (
      <Frame>
        <FullScreenLoader />
      </Frame>
    );
  }

  // 404 means the workspace is missing, deleted or not yours. One screen for all three.
  if (status === "notfound") {
    return (
      <Frame>
        <main className="mx-auto max-w-2xl px-6 py-24">
          <Link
            href="/workspaces"
            className="mb-8 inline-flex items-center gap-2 text-[13px] text-fg-2 transition-colors hover:text-ember-300"
          >
            <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" />
            All workspaces
          </Link>
          <Reveal level="balanced">
            <h1 className="text-glow font-display text-5xl leading-[1.05] tracking-tight">
              Workspace not found
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-fg-2">
              It may have been deleted, or you may not have access to it.
            </p>
          </Reveal>
        </main>
      </Frame>
    );
  }

  if (status === "error") {
    return (
      <Frame>
        <main className="mx-auto max-w-md space-y-4 px-6 py-24">
          <FormAlert message={error} />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={retry}
              className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
            >
              Try again
            </button>
            <Link
              href="/workspaces"
              className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
            >
              All workspaces
            </Link>
          </div>
        </main>
      </Frame>
    );
  }

  return (
    <Frame>
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-line bg-void/45 backdrop-blur-xl lg:block">
          <Sidebar />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-void/40 px-4 backdrop-blur-xl lg:hidden">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              className="grid size-9 place-items-center rounded-control text-fg transition-colors hover:bg-white/10"
            >
              <Menu size={18} strokeWidth={1.5} />
            </button>
            <span className="min-w-0 truncate text-[14px] font-medium">{workspace.name}</span>
          </div>

          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-4xl flex-1 px-6 py-10 sm:py-14">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Workspace navigation"
        >
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-void/70 backdrop-blur-sm"
          />
          <div className="drawer-panel absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-line bg-sidebar/95 backdrop-blur-xl">
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 grid size-9 place-items-center rounded-control text-fg-2 transition-colors hover:bg-white/10 hover:text-fg"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </Frame>
  );
}