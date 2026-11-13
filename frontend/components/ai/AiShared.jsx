"use client";

import { Info, Sparkles } from "lucide-react";
import FormAlert from "@/components/auth/FormAlert";
import { availability, describeProblem, privacyNote, providerLabel, quotaText } from "@/lib/ai";

// A small glowing orb with a sparkle: the mark for anything AI. It pulses while it's working.
export function AiOrb({ size = 28, busy = false }) {
  return (
    <span
      className={`ai-orb ${busy ? "ai-orb-busy" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Sparkles size={Math.round(size * 0.55)} strokeWidth={1.75} />
    </span>
  );
}

// Where the text goes. Always shown, and it says what's true for the current setup.
export function AiNotice({ status }) {
  return (
    <div className="ai-box flex gap-3 text-[12.5px] leading-relaxed text-fg-2">
      <Info size={15} strokeWidth={1.5} className="mt-0.5 shrink-0 text-fg-muted" aria-hidden="true" />
      <p>{privacyNote(status)}</p>
    </div>
  );
}

// "Test mode · 28 of 30 AI requests left today"
//   left: the newest count we know, if it's newer than the status.
export function AiStatusLine({ status, left }) {
  const remaining = left ?? status?.today?.requestsLeft;
  const text = [providerLabel(status), quotaText(remaining, status?.limits?.userDailyRequests)]
    .filter(Boolean)
    .join(" · ");

  return <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">{text}</p>;
}

// What to show when a request failed: the server's words, a hint, and Try again only where
// trying again could help.
export function AiProblem({ error, onRetry }) {
  const problem = describeProblem(error);

  return (
    <div className="space-y-3">
      <FormAlert message={problem.message} />
      {problem.hint && <p className="text-[13px] leading-relaxed text-fg-2">{problem.hint}</p>}
      {problem.canRetry && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
        >
          Try again
        </button>
      )}
    </div>
  );
}

// Shown while the AI works.
export function AiBusy({ label }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-[13px] text-fg-2">
        <AiOrb size={22} busy />
        <span>{label}</span>
      </div>
      <div className="skeleton h-4 w-11/12 rounded-chip" />
      <div className="skeleton h-4 w-9/12 rounded-chip" />
      <div className="skeleton h-4 w-10/12 rounded-chip" />
    </div>
  );
}

// Checks that AI can be used before showing any button. These are all different situations
// and each gets its own words: still checking, couldn't check, turned off, not set up.
//   status:   the result of useAiStatus(...)
//   children: (statusData) => the real screen, shown only when AI is available
export function AiGate({ status, children }) {
  if (status.status === "loading") {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <div className="skeleton h-16 rounded-card" />
        <div className="skeleton h-10 rounded-control" />
        <span className="sr-only">Checking whether AI is available</span>
      </div>
    );
  }

  // Never say "AI is off" when the real problem is a failed request.
  if (status.status === "error") {
    return (
      <div className="space-y-3">
        <FormAlert message={status.error} />
        <button
          type="button"
          onClick={status.retry}
          className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  const gate = availability(status.data);
  if (!gate.usable) {
    return (
      <div className="ai-box flex gap-3 text-[13px] leading-relaxed text-fg-2">
        <AiOrb size={24} />
        <p>{gate.message}</p>
      </div>
    );
  }

  return children(status.data);
}