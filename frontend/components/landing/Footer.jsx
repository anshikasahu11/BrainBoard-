import Link from "next/link";

// Placeholder links. Point them at real pages later.
const links = [
  { label: "Docs", href: "#" },
  { label: "GitHub", href: "https://github.com/" },
  { label: "Privacy", href: "#" },
];

export default function Footer() {
  return (
    <footer className="border-t border-line bg-void/55 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 py-6 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-2 sm:flex-row sm:justify-between">
        <span className="text-fg">BrainBoard</span>

        <nav aria-label="Footer" className="flex gap-5">
          {links.map((link) => (
            <Link key={link.label} href={link.href} className="transition-colors hover:text-ember-300">
              {link.label}
            </Link>
          ))}
        </nav>

        <span>{new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}