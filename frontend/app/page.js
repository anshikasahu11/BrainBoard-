import AmbientBackground from "@/components/AmbientBackground";
import Parallax from "@/components/Parallax";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import BoardPreview from "@/components/landing/BoardPreview";

export default function Home() {
  return (
    // Landing page motion level: expressive
    <div className="relative min-h-screen" data-motion="expressive">
      <Parallax />
      <AmbientBackground />
      <Navbar />
      <main>
        <Hero />
        <BoardPreview />
      </main>
    </div>
  );
}