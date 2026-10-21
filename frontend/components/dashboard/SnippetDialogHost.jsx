"use client";

import { useState } from "react";
import SnippetForm from "@/components/snippets/SnippetForm";
import SnippetViewer from "@/components/snippets/SnippetViewer";
import useAuth from "@/hooks/useAuth";
import useWorkspace from "@/hooks/useWorkspace";

// Opens the snippet dialogs right on the dashboard: viewing a snippet (with its full
// code), creating one, or editing one. It handles the switching between them (view,
// then edit, then back to view after a conflict) and only tells the dashboard when
// something actually changed. Mount it only while it's open.
//   start: { mode: "view", id } to open a snippet, or { mode: "form" } to create one.
export default function SnippetDialogHost({ start, onChanged, onClose }) {
  const { workspace, role } = useWorkspace();
  const { user } = useAuth();
  const [dialog, setDialog] = useState(start);

  if (dialog.mode === "view") {
    return (
      <SnippetViewer
        key={dialog.id}
        snippetId={dialog.id}
        workspaceId={workspace.id}
        role={role}
        userId={user.id}
        onEdit={(snippet) => setDialog({ mode: "form", snippet })}
        onDeleted={(snippet) => onChanged(`“${snippet.title}” was deleted.`)}
        onGone={() => onChanged("That snippet no longer exists.")}
        onClose={onClose}
      />
    );
  }

  return (
    <SnippetForm
      key={dialog.snippet?.id ?? "new"}
      snippet={dialog.snippet}
      workspaceId={workspace.id}
      onSaved={(snippet, verb) => onChanged(`“${snippet.title}” was ${verb}.`)}
      onGone={() => onChanged("That snippet no longer exists.")}
      // "Load latest version": go back to the viewer, which fetches it fresh.
      onReload={(id) => setDialog({ mode: "view", id })}
      onClose={onClose}
    />
  );
}