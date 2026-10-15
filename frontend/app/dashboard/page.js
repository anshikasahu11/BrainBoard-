import AmbientBackground from "@/components/AmbientBackground";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AccountPanel from "@/components/dashboard/AccountPanel";

export const metadata = { title: "Dashboard · BrainBoard" };

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      {/* App pages use the balanced motion level */}
      <div className="relative min-h-screen" data-motion="balanced">
        <AmbientBackground />
        <AccountPanel />
      </div>
    </ProtectedRoute>
  );
}