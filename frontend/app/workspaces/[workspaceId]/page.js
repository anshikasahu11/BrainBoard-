import DashboardOverview from "@/components/dashboard/DashboardOverview";

export const metadata = { title: "Dashboard · BrainBoard" };

// The shell (sidebar, loading and not-found screens) comes from layout.js.
export default function WorkspacePage() {
  return <DashboardOverview />;
}