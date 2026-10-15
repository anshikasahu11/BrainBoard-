import { redirect } from "next/navigation";

// There's no global dashboard any more. Dashboards live inside a workspace.
export default function DashboardPage() {
  redirect("/workspaces");
}