"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronsUpDown } from "lucide-react";
import useWorkspace from "@/hooks/useWorkspace";

// A dropdown for jumping between your workspaces.
export default function WorkspaceSwitcher({ onNavigate }) {
  const { workspace, workspaces } = useWorkspace();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const panelId = useId();

  // Close when you click elsewhere or press Escape.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // If the list hasn't loaded (or failed), still show the current workspace.
  const items = workspaces.length > 0 ? workspaces : [workspace];

  function handleNavigate() {
    setOpen(false);
    onNavigate?.();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="flex w-full items-center gap-2 rounded-control border border-line-strong bg-white/5 px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-white/10"
      >
        <span className="min-w-0 flex-1 truncate font-medium">{workspace.name}</span>
        <ChevronsUpDown
          size={15}
          strokeWidth={1.5}
          className="shrink-0 text-fg-muted"
          aria-hidden="true"
        />
      </button>

      {open && (
        <div id={panelId} className="glass absolute inset-x-0 top-full z-50 mt-2 rounded-card p-1.5">
          <p className="px-2.5 pb-1 pt-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
            Your workspaces
          </p>

          <ul className="max-h-60 overflow-y-auto">
            {items.map((item) => {
              const current = item.id === workspace.id;
              return (
                <li key={item.id}>
                  <Link
                    href={`/workspaces/${item.id}`}
                    onClick={handleNavigate}
                    aria-current={current ? "true" : undefined}
                    className="flex items-center gap-2 rounded-control px-2.5 py-2 text-[13px] transition-colors hover:bg-white/10"
                  >
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    {current && (
                      <Check
                        size={15}
                        strokeWidth={1.75}
                        className="shrink-0 text-ember-300"
                        aria-label="Current workspace"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-1 border-t border-line pt-1">
            <Link
              href="/workspaces"
              onClick={handleNavigate}
              className="block rounded-control px-2.5 py-2 text-[13px] text-fg-2 transition-colors hover:bg-white/10 hover:text-fg"
            >
              Manage workspaces
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}