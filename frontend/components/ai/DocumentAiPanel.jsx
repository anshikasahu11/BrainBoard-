"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Kanban, Loader2, Sparkles } from "lucide-react";
import FormAlert from "@/components/auth/FormAlert";
import { AiBusy, AiGate, AiNotice, AiProblem, AiStatusLine } from "@/components/ai/AiShared";
import { SummaryResult } from "@/components/ai/AiResults";
import SidePanel from "@/components/ui/SidePanel";
import useAiAction from "@/hooks/useAiAction";
import useAiStatus from "@/hooks/useAiStatus";

// The AI panel for a document: summarize it, or turn it into tasks. Mount it only while it's open.
//   prepare(): saves anything the person has typed first. Resolves true when it's safe to go on.
//              (Both actions work from the SAVED text, so this runs before anything is sent.)
export default function DocumentAiPanel({ workspaceId, documentId, title, prepare, onClose }) {
  const router = useRouter();
  const status = useAiStatus(workspaceId);
  const action = useAiAction(workspaceId, "summarize-document", { onDone: status.reload });

  const [preparing, setPreparing] = useState(false);
  const [saveProblem, setSaveProblem] = useState("");

  const busy = preparing || action.running;

  // Saves what was typed. Returns true when it's safe to carry on.
  async function saved(missing) {
    setSaveProblem("");
    setPreparing(true);

    try {
      const ready = await prepare();
      if (!ready) {
        setSaveProblem(
          `Your latest changes haven’t finished saving yet, so ${missing}. Try again in a moment.`
        );
      }
      return ready;
    } finally {
      setPreparing(false);
    }
  }

  async function summarize() {
    if (busy) return;
    if (await saved("the summary would miss them")) action.run({ documentId });
  }

  // The tasks are proposed and reviewed on the Tasks page, where they'd be added.
  async function turnIntoTasks() {
    if (busy) return;
    if (await saved("the tasks would miss them")) {
      router.push(`/workspaces/${workspaceId}/tasks?notes=${encodeURIComponent(documentId)}`);
    }
  }

  return (
    <SidePanel
      title="AI assistant"
      description="Everything here is made from the saved version of this document."
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

            <div className="space-y-3 border-t border-line pt-5">
              <h3 className="ai-heading">Meeting notes?</h3>
              <p className="text-[13px] leading-relaxed text-fg-2">
                Turn this document into a list of proposed tasks. You review them on the Tasks page, and
                nothing is added until you say so.
              </p>
              <button
                type="button"
                onClick={turnIntoTasks}
                disabled={busy}
                className="btn-ghost inline-flex items-center gap-2 rounded-control px-4 py-2 text-sm"
              >
                <Kanban size={15} strokeWidth={1.5} aria-hidden="true" />
                Turn the notes into tasks
              </button>
            </div>
          </div>
        )}
      </AiGate>
    </SidePanel>
  );
}