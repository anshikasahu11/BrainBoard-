"use client";

import { useState } from "react";
import HistoryPanel from "@/components/documents/history/HistoryPanel";
import VersionViewer from "@/components/documents/history/VersionViewer";
import useCoalescedReload from "@/hooks/useCoalescedReload";
import useLiveEvents from "@/hooks/useLiveEvents";
import useLoad from "@/hooks/useLoad";
import { listVersionsRequest } from "@/services/versionService";

// Runs the history feature while it's open: loads the list, keeps it live, and shows
// EITHER the panel OR a version's viewer (never both, so Esc and keyboard focus stay simple).
export default function HistoryController({
  workspaceId,
  documentId,
  role,
  restoreBlocked,
  prepare,
  getRevision,
  onRestored,
  onLoadLatest,
  onClose,
}) {
  const versions = useLoad(`versions:${documentId}`, () =>
    listVersionsRequest(workspaceId, documentId)
  );
  const [viewing, setViewing] = useState(null); // a version number, or null for the list

  // Live: when anyone saves or deletes a version of THIS document, refresh the list.
  const { reload } = versions;
  const liveReload = useCoalescedReload(reload, false, 300);
  const isThis = (payload) => payload?.workspaceId === workspaceId && payload?.documentId === documentId;

  useLiveEvents({
    "version:created": (payload) => isThis(payload) && liveReload(),
    "version:deleted": (payload) => isThis(payload) && liveReload(),
    // We were offline for a while, so events may have been missed.
    "connection:restored": () => liveReload(),
  });

  function backToList() {
    setViewing(null);
    reload();
  }

  if (viewing !== null) {
    return (
      <VersionViewer
        key={viewing}
        workspaceId={workspaceId}
        documentId={documentId}
        number={viewing}
        role={role}
        restoreBlocked={restoreBlocked}
        prepare={prepare}
        getRevision={getRevision}
        onRestored={onRestored}
        onDeleted={backToList}
        onGone={backToList}
        onLoadLatest={onLoadLatest}
        onClose={() => setViewing(null)}
      />
    );
  }

  return (
    <HistoryPanel
      workspaceId={workspaceId}
      documentId={documentId}
      versions={versions}
      prepare={prepare}
      onCreated={reload}
      onOpen={setViewing}
      onClose={onClose}
    />
  );
}