import AmbientBackground from "@/components/AmbientBackground";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";

export default function Home() {
  return (
    // Landing page motion level: expressive
    <div className="relative min-h-screen" data-motion="expressive">
      <AmbientBackground />
      <Navbar />
      <main>
        <Hero />
      </main>
    </div>
  );
}