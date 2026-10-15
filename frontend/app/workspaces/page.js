import AmbientBackground from "@/components/AmbientBackground";
import Reveal from "@/components/Reveal";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AppHeader from "@/components/app/AppHeader";
import WorkspaceList from "@/components/workspaces/WorkspaceList";
import CreateWorkspaceForm from "@/components/workspaces/CreateWorkspaceForm";

export const metadata = { title: "Workspaces · BrainBoard" };

export default function WorkspacesPage() {
  return (
    <ProtectedRoute>
      {/* App pages use the balanced motion level */}
      <div className="relative min-h-screen" data-motion="balanced">
        <AmbientBackground />
        <AppHeader />

        <main className="mx-auto max-w-5xl px-6 py-14">
          <Reveal level="balanced">
            <p className="eyebrow mb-4">
              <span className="size-1.5 rounded-full bg-ember-300" />
              Your workspaces
            </p>
          </Reveal>

          <Reveal level="balanced" delay={0.1}>
            <h1 className="text-glow font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
              Choose a workspace
            </h1>
          </Reveal>

          <div className="mt-10">
            <WorkspaceList />
          </div>

          <Reveal level="balanced" inView className="mt-16">
            <section aria-labelledby="create-heading" className="glass max-w-md rounded-panel p-7">
              <h2 id="create-heading" className="font-display text-3xl leading-[1.1]">
                Create a new workspace
              </h2>
              <p className="mb-6 mt-2 text-[13px] text-fg-2">
                A shared home for your team&apos;s documents, tasks and code.
              </p>
              <CreateWorkspaceForm />
            </section>
          </Reveal>
        </main>
      </div>
    </ProtectedRoute>
  );
}