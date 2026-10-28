"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Reveal from "@/components/Reveal";
import FormAlert from "@/components/auth/FormAlert";
import DocumentEditor from "@/components/documents/DocumentEditor";
import useWorkspace from "@/hooks/useWorkspace";
import { getDocumentRequest } from "@/services/documentService";

export default function DocumentView() {
  const { documentId } = useParams();
  const { workspace } = useWorkspace();
  const [state, setState] = useState({ id: null, status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState(""); // shown in the editor after a reload (for example, after a restore)

  useEffect(() => {
    let cancelled = false;

    getDocumentRequest(workspace.id, documentId)
      .then((data) => {
        if (!cancelled) setState({ id: documentId, status: "ready", document: data.document });
      })
      .catch((error) => {
        if (cancelled) return;
        // 404 covers "doesn't exist", "deleted" and "another workspace's document".
        setState(
          error.status === 404
            ? { id: documentId, status: "notfound" }
            : { id: documentId, status: "error", message: error.message }
        );
      });

    return () => {
      cancelled = true;
    };
  }, [workspace.id, documentId, reloadKey]);

  // Throw away local edits and load the latest version. An optional message is shown in the
  // editor afterwards. (Buttons call this with a click event, which isn't a message.)
  const reload = useCallback((message) => {
    setNotice(typeof message === "string" ? message : "");
    setState({ id: null, status: "loading" });
    setReloadKey((key) => key + 1);
  }, []);

  // Treat results for a different document as "still loading".
  const current = state.id === documentId ? state : { status: "loading" };

  const back = (
    <Link
      href={`/workspaces/${workspace.id}/documents`}
      className="mb-8 inline-flex items-center gap-2 text-[13px] text-fg-2 transition-colors hover:text-ember-300"
    >
      <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" />
      All documents
    </Link>
  );

  if (current.status === "loading") {
    return (
      <div role="status" aria-live="polite">
        {back}
        <div className="skeleton h-12 w-72 rounded-card" />
        <span className="sr-only">Loading document</span>
      </div>
    );
  }

  if (current.status === "notfound") {
    return (
      <div>
        {back}
        <Reveal level="balanced">
          <h1 className="text-glow font-display text-5xl leading-[1.05] tracking-tight">
            Document not found
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-fg-2">
            It may have been deleted, or it may not exist in this workspace.
          </p>
        </Reveal>
      </div>
    );
  }

  if (current.status === "error") {
    return (
      <div className="max-w-md space-y-4">
        {back}
        <FormAlert message={current.message} />
        <button
          type="button"
          onClick={() => reload()}
          className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  // The key restarts the editor whenever a different document (or a reloaded
  // version) arrives, so one document's text can never appear in another.
  return (
    <DocumentEditor
      key={`${current.document.id}:${reloadKey}`}
      initialDoc={current.document}
      initialNotice={notice}
      onReload={reload}
    />
  );
}