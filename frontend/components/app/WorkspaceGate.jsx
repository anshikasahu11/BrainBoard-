"use client";

import { useParams } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AppShell from "@/components/app/AppShell";
import { WorkspaceProvider } from "@/context/WorkspaceContext";

// Wraps every page under /workspaces/<id>/...
// 1. Signed-out visitors are sent to the login page.
// 2. The workspace is loaded once and shared with the whole shell.
// 3. The "key" restarts the provider when the ID changes, so one workspace's
//    data can never appear under another one's name.
export default function WorkspaceGate({ children }) {
  const { workspaceId } = useParams();

  return (
    <ProtectedRoute>
      <WorkspaceProvider key={workspaceId}>
        <AppShell>{children}</AppShell>
      </WorkspaceProvider>
    </ProtectedRoute>
  );
}