import WorkspaceOverview from "@/components/workspaces/WorkspaceOverview";

export const metadata = { title: "Workspace · BrainBoard" };

// The shell (sidebar, loading and not-found screens) comes from layout.js.
export default function WorkspacePage() {
  return <WorkspaceOverview />;
}