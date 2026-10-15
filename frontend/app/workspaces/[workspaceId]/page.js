
import AmbientBackground from "@/components/AmbientBackground";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AppHeader from "@/components/app/AppHeader";
import WorkspaceHome from "@/components/workspaces/WorkspaceHome";

export const metadata = { title: "Workspace · BrainBoard" };

export default function WorkspacePage() {
  return (
    <ProtectedRoute>
      <div className="relative min-h-screen" data-motion="balanced">
        <AmbientBackground />
        <AppHeader />

        <main className="mx-auto max-w-5xl px-6 py-14">
          <WorkspaceHome />
        </main>
      </div>
    </ProtectedRoute>
  );
}