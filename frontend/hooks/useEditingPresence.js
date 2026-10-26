"use client";

import { useEffect, useState } from "react";
import useRealtime from "@/hooks/useRealtime";

// Says "I'm editing this document" while the editor is open and this tab is visible,
// and "I stopped" when you leave, switch to another tab, or the connection drops.
// It says it again after a reconnect (the server forgets it when a connection ends).
// This is information for teammates. It doesn't lock anything.
// Pass a falsy documentId (for example, once the document was deleted) to stop.
export default function useEditingPresence(workspaceId, documentId) {
  const { joined, focusDocument, blurDocument } = useRealtime();
  const inRoom = joined.includes(workspaceId);

  // A document in a background tab doesn't count as being edited.
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (!inRoom || !visible || !documentId) return;

    focusDocument(workspaceId, documentId);
    return () => blurDocument(workspaceId);
  }, [inRoom, visible, workspaceId, documentId, focusDocument, blurDocument]);
}