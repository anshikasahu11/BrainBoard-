"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import FormAlert from "@/components/auth/FormAlert";
import { AiBusy, AiGate, AiNotice, AiProblem, AiStatusLine } from "@/components/ai/AiShared";
import { SummaryResult } from "@/components/ai/AiResults";
import SidePanel from "@/components/ui/SidePanel";
import useAiAction from "@/hooks/useAiAction";
import useAiStatus from "@/hooks/useAiStatus";

// The AI panel for a document: summarize it. Mount it only while it's open.
//   prepare(): saves anything the person has typed first. Resolves true when it's safe to go on.
//              (A summary is made from the SAVED text, so this runs before anything is sent.)
export default function DocumentAiPanel({ workspaceId, documentId, title, prepare, onClose }) {
  const status = useAiStatus(workspaceId);
  const action = useAiAction(workspaceId, "summarize-document", { onDone: status.reload });

  const [preparing, setPreparing] = useState(false);
  const [saveProblem, setSaveProblem] = useState("");

  const busy = preparing || action.running;

  async function summarize() {
    if (busy) return;

    setSaveProblem("");
    setPreparing(true);

    try {
      const ready = await prepare();
      if (!ready) {
        setSaveProblem(
          "Your latest changes haven’t finished saving yet, so the summary would miss them. Try again in a moment."
        );
        return;
      }
      action.run({ documentId });
    } finally {
      setPreparing(false);
    }
  }

  return (
    <SidePanel
      title="AI assistant"
      description="Summaries are made from the saved version of this document."
      onClose={onClose}
    >
      <AiGate status={status}>
        {(data) => (
          <div className="space-y-5">
            <AiNotice status={data} />
            <AiStatusLine status={data} left={action.meta?.quota?.requestsLeft} />

            <button
              type="button"
              onClick={summarize}
              disabled={busy}
              className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-control px-4 py-2.5 text-sm"
            >
              {busy ? (
                <Loader2 size={15} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles size={15} strokeWidth={1.75} aria-hidden="true" />
              )}
              {busy ? "Working…" : action.phase === "done" ? "Summarize again" : "Summarize this document"}
            </button>

            {saveProblem && <FormAlert message={saveProblem} />}

            <div aria-busy={busy}>
              {action.phase === "running" && <AiBusy label="Reading the document…" />}
              {action.phase === "error" && <AiProblem error={action.error} onRetry={summarize} />}
              {action.phase === "done" && (
                <SummaryResult result={action.result} truncated={action.meta?.truncated} title={title} />
              )}
            </div>
          </div>
        )}
      </AiGate>
    </SidePanel>
  );
}