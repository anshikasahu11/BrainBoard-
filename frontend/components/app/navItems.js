import { LayoutDashboard, FileText, Kanban, Code, Users, Settings } from "lucide-react";

// The sidebar menu. `path` is added after /workspaces/<id>.
// soon: true shows the item dimmed and not clickable, until its page exists.
export const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "", group: "work" },
  { key: "documents", label: "Documents", icon: FileText, group: "work", soon: true },
  { key: "tasks", label: "Tasks", icon: Kanban, group: "work", soon: true },
  { key: "snippets", label: "Snippets", icon: Code, group: "work", soon: true },
  { key: "members", label: "Members", icon: Users, path: "/members", group: "manage" },
  { key: "settings", label: "Settings", icon: Settings, path: "/settings", group: "manage" },
];