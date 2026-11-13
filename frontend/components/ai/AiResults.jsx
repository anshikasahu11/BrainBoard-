"use client";

import { AlertTriangle } from "lucide-react";
import CodeBlock from "@/components/snippets/CodeBlock";
import CopyButton from "@/components/snippets/CopyButton";
import { explanationAsText, summaryAsText } from "@/lib/ai";

// How AI answers are shown. Everything is plain text drawn by React: nothing is ever put into
// the page as HTML. Each answer ends with a reminder that AI can be wrong.

const REMINDER = "AI can get things wrong. Check anything important.";

export function SummaryResult({ result, truncated, title }) {
  if (!result.summary && result.keyPoints.length === 0) {
    return <p className="text-[14px] text-fg-2">There wasn’t anything to summarize.</p>;
  }

  return (
    <div className="space-y-4">
      {result.summary && <p className="text-[15px] leading-relaxed">{result.summary}</p>}

      {result.keyPoints.length > 0 && (
        <div>
          <h3 className="ai-heading">Key points</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-fg-2">
            {result.keyPoints.map((point, index) => (
              <li key={index}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {truncated && <p className="ai-note">This document is long, so only the first part was used.</p>}

      <CopyButton subject={title} what="summary" getText={() => summaryAsText(result)} />
      <p className="ai-note">{REMINDER}</p>
    </div>
  );
}

export function ExplanationResult({ result, truncated, title }) {
  return (
    <div className="space-y-4">
      {result.overview && <p className="text-[15px] leading-relaxed">{result.overview}</p>}

      {result.steps.length > 0 && (
        <div>
          <h3 className="ai-heading">Step by step</h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed text-fg-2">
            {result.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {result.watchOutFor.length > 0 && (
        <div>
          <h3 className="ai-heading">Watch out for</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-fg-2">
            {result.watchOutFor.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {truncated && <p className="ai-note">This code is long, so only the first part was explained.</p>}

      <CopyButton subject={title} what="explanation" getText={() => explanationAsText(result)} />
      <p className="ai-note">{REMINDER}</p>
    </div>
  );
}

// The improved code is shown and can be copied, but it is NEVER applied: the snippet is untouched.
export function ImprovementResult({ result, unchanged, warnings = [], language, title }) {
  return (
    <div className="space-y-4">
      {result.summary && <p className="text-[15px] leading-relaxed">{result.summary}</p>}

      {result.suggestions.length > 0 && (
        <div>
          <h3 className="ai-heading">Suggestions</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-fg-2">
            {result.suggestions.map((item, index) => (
              <li key={index}>
                <span className="font-medium text-fg">{item.title}</span>
                {item.reason && <span> {item.reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="ai-warn flex gap-3">
          <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-amber" aria-hidden="true" />
          <div className="min-w-0 space-y-1.5 text-[13px] leading-relaxed">
            <p className="font-medium text-fg">Check this before you use it</p>
            <ul className="space-y-1 text-fg-2">
              {warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {unchanged ? (
        <p className="text-[14px] text-fg-2">No changes suggested: the AI gave your code back as it is.</p>
      ) : (
        <div className="space-y-3">
          <h3 className="ai-heading">Improved code</h3>
          <CodeBlock
            code={result.improvedCode}
            language={language}
            label={`Improved code for ${title}`}
            scrollable
            className="code-block-full"
          />
          <CopyButton subject={title} what="improved code" getText={() => result.improvedCode} />
        </div>
      )}

      <p className="ai-note">
        Nothing was saved: your snippet is exactly as it was. Read improved code carefully and test it
        before you use it. {REMINDER}
      </p>
    </div>
  );
}