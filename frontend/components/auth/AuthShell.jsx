import AmbientBackground from "@/components/AmbientBackground";
import Parallax from "@/components/Parallax";
import Reveal from "@/components/Reveal";
import Logo from "@/components/Logo";

// The shared layout for the login and register pages.
export default function AuthShell({ title, subtitle, footer, children }) {
  return (
    // Auth pages use the expressive motion level, like the landing page.
    <div className="relative flex min-h-screen flex-col" data-motion="expressive">
      <Parallax />
      <AmbientBackground />

      <header className="mx-auto flex w-full max-w-6xl items-center px-6 py-6">
        <Logo />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-20">
        <Reveal level="expressive" className="w-full max-w-md">
          <div className="glass rounded-panel p-7 sm:p-9">
            <h1 className="font-display text-4xl leading-[1.08] tracking-tight">{title}</h1>
            <p className="mt-2 text-[14px] text-fg-2">{subtitle}</p>

            <div className="mt-7">{children}</div>
          </div>

          <p className="text-glow mt-6 text-center text-[13px] text-fg-2">{footer}</p>
        </Reveal>
      </main>
    </div>
  );
}