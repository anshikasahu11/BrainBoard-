"use client";

import { useContext } from "react";
import { WorkspaceContext } from "@/context/WorkspaceContext";

// Usage: const { workspace, role, workspaces, patchWorkspace } = useWorkspace();
export default function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  }
  return context;
}