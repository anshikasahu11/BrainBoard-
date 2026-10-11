import Link from "next/link";
import Logo from "@/components/Logo";
import Reveal from "@/components/Reveal";

// Docs and Pricing are placeholders until those pages exist.
const links = [
  { label: "Product", href: "#product" },
  { label: "Docs", href: "#" },
  { label: "Pricing", href: "#" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-void/40 backdrop-blur-xl">
      <Reveal level="subtle">
        <nav
          className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6"
          aria-label="Main"
        >
          <Logo />

          <ul className="hidden items-center gap-8 text-[13px] md:flex">
            {links.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-fg transition-colors hover:text-ember-300"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="hidden text-[13px] text-fg transition-colors hover:text-ember-300 sm:inline"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="btn-primary inline-flex items-center rounded-control px-4 py-2 text-[13px]"
            >
              Get started
            </Link>
          </div>
        </nav>
      </Reveal>
    </header>
  );
}