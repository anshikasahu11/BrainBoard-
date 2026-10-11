import AmbientBackground from "@/components/AmbientBackground";
import StatusCard from "@/components/StatusCard";

export const metadata = { title: "System status · BrainBoard" };

export default function StatusPage() {
  return (
    <main
      className="relative flex min-h-screen items-center justify-center px-6"
      data-motion="subtle"
    >
      <AmbientBackground />
      <StatusCard />
    </main>
  );
}