"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Reveal from "@/components/Reveal";
import FormAlert from "@/components/auth/FormAlert";
import useWorkspace from "@/hooks/useWorkspace";
import { getDocumentRequest } from "@/services/documentService";
import { formatDate, formatRelative } from "@/lib/format";

export default function DocumentView() {
  const { documentId } = useParams();
  const { workspace } = useWorkspace();
  const [state, setState] = useState({ id: null, status: "loading" });

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
  }, [workspace.id, documentId]);

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
      <div className="max-w-md">
        {back}
        <FormAlert message={current.message} />
      </div>
    );
  }

  const doc = current.document;

  return (
    <div>
      {back}

      <Reveal level="balanced">
        <h1 className="text-glow font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          {doc.title}
        </h1>
      </Reveal>

      <Reveal level="balanced" delay={0.1}>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-2">
          Created {formatDate(doc.createdAt)} by {doc.createdBy.name} · Edited{" "}
          {formatRelative(doc.updatedAt)} by {doc.lastEditedBy.name} · Revision {doc.revision}
        </p>
      </Reveal>

      <Reveal level="balanced" delay={0.2} className="mt-10">
        <div className="glass max-w-xl rounded-card p-6">
          <p className="text-[15px] font-medium">The editor is on its way</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-fg-2">
            Next we build the rich-text editor, with a toolbar and autosave. For now this page proves
            the document loads from the API.
          </p>
        </div>
      </Reveal>
    </div>
  );
}