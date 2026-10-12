import AmbientBackground from "@/components/AmbientBackground";
import Parallax from "@/components/Parallax";
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
    // Landing page motion level: expressive
    <div className="relative min-h-screen" data-motion="expressive">
      <Parallax />
      <AmbientBackground />
      <Navbar />
      <main>
        <Hero />
        <Ruler />
        <BoardPreview />
        <Stats />
        <Features />
        <AiBand />
        <ClosingCta />
      </main>
      <Footer />
    </div>
  );
}