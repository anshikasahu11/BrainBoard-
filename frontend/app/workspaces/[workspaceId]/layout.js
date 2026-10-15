
import WorkspaceGate from "@/components/app/WorkspaceGate";

// Every page under /workspaces/<id>/ renders inside the workspace shell.
export default function WorkspaceLayout({ children }) {
  return <WorkspaceGate>{children}</WorkspaceGate>;
}