import TaskBoard from "@/components/tasks/TaskBoard";

export const metadata = { title: "Tasks · BrainBoard" };

// The shell (sidebar, loading and not-found screens) comes from the workspace layout.js.
export default function TasksPage() {
  return <TaskBoard />;
}