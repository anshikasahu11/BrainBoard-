"use client";

import { useId, useState } from "react";
import { FileText, Loader2, Sparkles } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { AiBusy, AiGate, AiNotice, AiProblem, AiStatusLine } from "@/components/ai/AiShared";
import ProposalReview from "@/components/ai/ProposalReview";
import useAiAction from "@/hooks/useAiAction";
import useAiStatus from "@/hooks/useAiStatus";
import useLoad from "@/hooks/useLoad";
import { todayISO } from "@/lib/tasks";
import { getDocumentRequest } from "@/services/documentService";

// Turns notes into PROPOSED tasks, which you review before anything is created.
//   source:  { type: "text" } to paste notes, or { type: "document", id } to use a document.
//   members: who can be assigned.
//   onAdded(count): the tasks were added.  onClose: closed without adding.
// Mount it only while it's open. Nothing is sent until "Propose tasks" is pressed.
export default function NotesToTasksDialog({ workspaceId, source, members, onAdded, onClose }) {
  const status = useAiStatus(workspaceId);
  const action = useAiAction(workspaceId, "tasks-from-text", { onDone: status.reload });

  const isDocument = source.type === "document";
  const document = useLoad(`notes-source:${isDocument ? source.id : "text"}`, () =>
    isDocument ? getDocumentRequest(workspaceId, source.id) : Promise.resolve(null)
  );

  const fieldId = useId();
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const reviewing = action.phase === "done";

  // Closing a review throws the proposals away, and asking again uses another request.
  function requestClose() {
    if (adding) return;

    if (reviewing && action.result.tasks.length > 0) setConfirming(true);
    else onClose();
  }

  function propose() {
    if (action.running) return;

    setConfirming(false);
    const today = todayISO();
    action.run(isDocument ? { documentId: source.id, today } : { text, today });
  }

  const canPropose = !action.running && (isDocument ? document.status === "ready" : text.trim().length > 0);

  return (
    <Modal title="Turn notes into tasks" onClose={requestClose} busy={adding} size="lg">
      <AiGate status={status}>
        {(data) => (
          <div className="space-y-4">
            {!reviewing && (
              <>
                <AiNotice status={data} />
                <AiStatusLine status={data} left={action.meta?.quota?.requestsLeft} />

                {isDocument ? (
                  <div className="ai-box flex items-center gap-3 text-[13px] text-fg-2">
                    <FileText size={15} strokeWidth={1.5} className="shrink-0 text-fg-muted" aria-hidden="true" />
                    {document.status === "loading" && <span>Looking up the document…</span>}
                    {document.status === "error" && <span className="text-danger">{document.error}</span>}
                    {document.status === "ready" && (
                      <span>
                        Using the saved text of <strong className="font-medium text-fg">{document.data.document.title}</strong>
                      </span>
                    )}
                  </div>
                ) : (
                  <div>
                    <label htmlFor={fieldId} className="mb-1.5 block text-[13px] text-fg-2">
                      Paste your notes
                    </label>
                    <textarea
                      id={fieldId}
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      rows={8}
                      maxLength={100000}
                      disabled={action.running}
                      placeholder="For example: Rahul will write the report by Friday. Someone should book the room. The login bug is urgent."
                      className="input textarea"
                    />
                    <p className="mt-1.5 font-mono text-[11px] text-fg-muted">
                      {text.length.toLocaleString("en-US")} characters
                      {text.length > data.limits.maxInputChars &&
                        ` · only the first ${data.limits.maxInputChars.toLocaleString("en-US")} will be used`}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={propose}
                  disabled={!canPropose}
                  className="btn-primary inline-flex items-center gap-2 rounded-control px-5 py-2 text-sm"
                >
                  {action.running ? (
                    <Loader2 size={15} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles size={15} strokeWidth={1.75} aria-hidden="true" />
                  )}
                  {action.running ? "Working…" : "Propose tasks"}
                </button>

                <div aria-busy={action.running}>
                  {action.phase === "running" && <AiBusy label="Reading the notes…" />}
                  {action.phase === "error" && <AiProblem error={action.error} onRetry={propose} />}
                </div>
              </>
            )}

            {reviewing && (
              <>
                {confirming && (
                  <div className="rounded-card border border-danger/40 bg-scorched/60 p-4">
                    <p className="text-[14px]">Close without adding these tasks?</p>
                    <p className="mt-1 text-[13px] text-fg-2">
                      The proposals will be thrown away, and asking again uses another AI request.
                    </p>
                    <div className="mt-4 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setConfirming(false)}
                        className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
                      >
                        Keep reviewing
                      </button>
                      <button
                        type="button"
                        onClick={onClose}
                        className="btn-danger inline-flex items-center rounded-control px-4 py-2 text-sm"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                )}

                <ProposalReview
                  workspaceId={workspaceId}
                  members={members}
                  result={action.result}
                  truncated={action.meta?.truncated}
                  adding={adding}
                  setAdding={setAdding}
                  onAdded={onAdded}
                  onBack={() => {
                    setConfirming(false);
                    action.reset();
                  }}
                />

                <p className="ai-note">AI can get things wrong. Check anything important.</p>
              </>
            )}
          </div>
        )}
      </AiGate>
    </Modal>
  );
}