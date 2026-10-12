"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

// Hamburger button and dropdown, shown only below the md breakpoint.
export default function NavMenu({ links }) {
  const [open, setOpen] = useState(false);

  // Close with the Escape key while the menu is open.
  useEffect(() => {
    if (!open) return;
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className="grid size-9 place-items-center rounded-control text-fg transition-colors hover:bg-white/10"
      >
        {open ? <X size={18} strokeWidth={1.5} /> : <Menu size={18} strokeWidth={1.5} />}
      </button>

      {open && (
        <div
          id="mobile-menu"
          className="glass menu-panel absolute inset-x-4 top-[68px] rounded-card p-3"
        >
          <ul className="flex flex-col">
            {links.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-control px-3 py-2.5 text-[14px] text-fg transition-colors hover:bg-white/10"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="mt-1 border-t border-line pt-1">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block rounded-control px-3 py-2.5 text-[14px] text-fg transition-colors hover:bg-white/10"
              >
                Sign in
              </Link>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}