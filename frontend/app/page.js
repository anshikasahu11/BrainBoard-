import AmbientBackground from "@/components/AmbientBackground";
import Parallax from "@/components/Parallax";
import Reveal from "@/components/Reveal";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Ruler from "@/components/landing/Ruler";
import BoardPreview from "@/components/landing/BoardPreview";
import Stats from "@/components/landing/Stats";
import Features from "@/components/landing/Features";
import AiBand from "@/components/landing/AiBand";
import ClosingCta from "@/components/landing/ClosingCta";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    // Landing page motion level: expressive (the hero entrance).
    // Sections further down use the lighter "balanced" reveal as you scroll.
    <div className="relative min-h-screen" data-motion="expressive">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <Parallax />
      <AmbientBackground />
      <Navbar />

      <main id="main" tabIndex={-1}>
        <Hero />

        <Reveal level="balanced" inView>
          <Ruler />
        </Reveal>
        <Reveal level="balanced" inView>
          <BoardPreview />
        </Reveal>
        <Reveal level="balanced" inView>
          <Stats />
        </Reveal>
        <Reveal level="balanced" inView>
          <Features />
        </Reveal>
        <Reveal level="balanced" inView>
          <AiBand />
        </Reveal>
        <Reveal level="balanced" inView>
          <ClosingCta />
        </Reveal>
      </main>

      <Footer />
    </div>
  );
}