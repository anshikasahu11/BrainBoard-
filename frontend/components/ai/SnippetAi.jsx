"use client";

import { useId, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { AiBusy, AiGate, AiNotice, AiProblem, AiStatusLine } from "@/components/ai/AiShared";
import { ExplanationResult, ImprovementResult } from "@/components/ai/AiResults";
import useAiAction from "@/hooks/useAiAction";
import useAiStatus from "@/hooks/useAiStatus";
import { GOALS } from "@/lib/ai";

// The AI tabs of the snippet viewer: "explain" or "improve". It reads the saved snippet on the
// server, so nothing here needs sending from the browser except which snippet and which goal.
//   onUseCode(code): opens the improved code in the editor for review (improve only).
export default function SnippetAi({ workspaceId, snippet, mode, onUseCode }) {
  const improving = mode === "improve";
  const goalId = useId();

  const status = useAiStatus(workspaceId);
  const action = useAiAction(workspaceId, improving ? "improve-snippet" : "explain-snippet", {
    onDone: status.reload,
  });
  const [goal, setGoal] = useState("general");

  function run() {
    if (action.running) return;
    action.run(improving ? { snippetId: snippet.id, goal } : { snippetId: snippet.id });
  }

  const label = improving ? "Suggest improvements" : "Explain this code";
  const again = improving ? "Suggest again" : "Explain again";

  return (
    <AiGate status={status}>
      {(data) => (
        <div className="space-y-4">
          <AiNotice status={data} />
          <AiStatusLine status={data} left={action.meta?.quota?.requestsLeft} />

          {improving && (
            <div>
              <label htmlFor={goalId} className="mb-1.5 block text-[13px] text-fg-2">
                What should it focus on?
              </label>
              <select
                id={goalId}
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                disabled={action.running}
                className="input input-sm"
              >
                {GOALS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={run}
            disabled={action.running}
            className="btn-primary inline-flex items-center gap-2 rounded-control px-5 py-2 text-sm"
          >
            {action.running ? (
              <Loader2 size={15} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles size={15} strokeWidth={1.75} aria-hidden="true" />
            )}
            {action.running ? "Working…" : action.phase === "done" ? again : label}
          </button>

          <div aria-busy={action.running}>
            {action.phase === "running" && (
              <AiBusy label={improving ? "Reviewing the code…" : "Reading the code…"} />
            )}
            {action.phase === "error" && <AiProblem error={action.error} onRetry={run} />}

            {action.phase === "done" && !improving && (
              <ExplanationResult result={action.result} truncated={action.meta?.truncated} title={snippet.title} />
            )}
            {action.phase === "done" && improving && (
              <ImprovementResult
                result={action.result}
                unchanged={action.meta?.unchanged}
                warnings={action.meta?.warnings}
                language={snippet.language}
                title={snippet.title}
                onUseCode={onUseCode}
              />
            )}
          </div>
        </div>
      )}
    </AiGate>
  );
}