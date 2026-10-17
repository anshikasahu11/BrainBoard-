"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { createDocumentRequest } from "@/services/documentService";

// Creates a document and opens it. Shared by every "New document" button.
// Usage: const { create, creating, error } = useCreateDocument(workspace.id);
export default function useCreateDocument(workspaceId) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const create = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    setError("");

    try {
      const { document: created } = await createDocumentRequest(workspaceId);
      // Go straight into the new document. "creating" stays on, so the button
      // doesn't flicker during the navigation.
      router.push(`/workspaces/${workspaceId}/documents/${created.id}`);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }, [creating, workspaceId, router]);

  return { create, creating, error };
}