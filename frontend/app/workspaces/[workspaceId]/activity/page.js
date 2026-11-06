import ActivityPanel from "@/components/activity/ActivityPanel";

export const metadata = { title: "Activity · BrainBoard" };

// The shell (sidebar, loading and not-found screens) comes from the workspace layout.js.
export default function ActivityPage() {
  return <ActivityPanel />;
}