"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import FormAlert from "@/components/auth/FormAlert";
import DiffView from "@/components/documents/history/DiffView";
import useLoad from "@/hooks/useLoad";
import { collapseEntries, compareDocuments } from "@/lib/docDiff";
import { getDocumentRequest } from "@/services/documentService";
import { getVersionRequest } from "@/services/versionService";

const MAX_LINES_SHOWN = 1500;

// Compares one version (the "target") with the current document, or with another version.
//   version: the version being viewed, WITH its content: { number, title, content }
//   others:  the other versions in the list (for the "Compare with" menu)
//   prepare(): saves anything the person has typed, so "current" really is what's on screen
export default function CompareView({ workspaceId, documentId, version, others, prepare }) {
  const selectId = useId();
  const [chosen, setChosen] = useState("current"); // "current" or a version number as text
  const [showAll, setShowAll] = useState(false);

  // If the version you picked is deleted while you look, fall back to the current document.
  const choice =
    chosen === "current" || others.some((other) => String(other.number) === chosen) ? chosen : "current";

  // The newest prepare() is always the one called, without restarting the load.
  const prepareRef = useRef(prepare);
  useEffect(() => {
    prepareRef.current = prepare;
  });

  const loaded = useLoad(`compare:${documentId}:${version.number}:${choice}`, async () => {
    if (choice === "current") {
      // Save what was just typed first, then read what the server holds: that's exactly
      // what restoring would replace.
      let saved = false;
      try {
        saved = await prepareRef.current();
      } catch {
        saved = false;
      }
      const { document } = await getDocumentRequest(workspaceId, documentId);
      return { base: { title: document.title, content: document.content }, unsaved: !saved };
    }

    const { version: other } = await getVersionRequest(workspaceId, documentId, Number(choice));
    return { base: { title: other.title, content: other.content }, unsaved: false };
  });

  const result = useMemo(
    () => (loaded.status === "ready" ? compareDocuments(loaded.data.base, version) : null),
    [loaded.status, loaded.data, version]
  );

  const entries = useMemo(() => {
    if (!result || result.tooLarge) return [];
    return showAll ? result.entries : collapseEntries(result.entries, 2);
  }, [result, showAll]);

  const shown = entries.slice(0, MAX_LINES_SHOWN);
  const baseName = choice === "current" ? "the current document" : `version ${choice}`;

  const hint =
    choice === "current"
      ? "Green is text that restoring this version would add. Red is text it would remove."
      : `Green is in version ${version.number} but not in version ${choice}. Red is in version ${choice} but not in version ${version.number}.`;

  let summary = "";
  if (result) {
    if (result.tooLarge) summary = "These two are too large and too different to compare line by line.";
    else if (result.identical) summary = `Version ${version.number} is identical to ${baseName}.`;
    else {
      const { added, removed } = result.stats;
      summary = `${added} ${added === 1 ? "line" : "lines"} added · ${removed} ${
        removed === 1 ? "line" : "lines"
      } removed`;
    }
  }

  const hasUnchanged = result && !result.tooLarge && result.entries.some((entry) => entry.type === "equal");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label htmlFor={selectId} className="text-[13px] text-fg-2">
          Compare with
        </label>
        <select
          id={selectId}
          value={choice}
          onChange={(event) => setChosen(event.target.value)}
          className="input input-sm"
        >
          <option value="current">Current document</option>
          {others.map((other) => (
            <option key={other.number} value={String(other.number)}>
              {`Version ${other.number}${other.label ? ` · ${other.label}` : ""}`}
            </option>
          ))}
        </select>

        {choice === "current" && (
          <button
            type="button"
            onClick={loaded.retry}
            className="text-[13px] text-fg-2 underline underline-offset-4 transition-colors hover:text-ember-300"
          >
            Refresh
          </button>
        )}
      </div>

      <p className="text-[12px] leading-relaxed text-fg-muted">{hint}</p>

      {loaded.status === "loading" && (
        <div role="status" aria-live="polite">
          <div className="skeleton h-32 rounded-card" />
          <span className="sr-only">Loading comparison</span>
        </div>
      )}

      {/* Never show "no differences" when the real problem is a failed request. */}
      {loaded.status === "error" && (
        <div className="space-y-3">
          <FormAlert message={loaded.error} />
          <button
            type="button"
            onClick={() => setChosen("current")}
            className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
          >
            Compare with the current document
          </button>
        </div>
      )}

      {result && (
        <>
          {loaded.data.unsaved && (
            <p className="text-[13px] leading-relaxed text-amber">
              Your latest changes haven’t finished saving, so they aren’t included in this comparison.
            </p>
          )}

          <p role="status" aria-live="polite" className="text-[14px] font-medium">
            {summary}
          </p>

          {result.titleChanged && (
            <p className="text-[13px] leading-relaxed text-fg-2">
              Title: <del className="diff-del">{result.titleChanged.from}</del> →{" "}
              <ins className="diff-ins">{result.titleChanged.to}</ins>
            </p>
          )}

          {!result.identical && !result.tooLarge && entries.length > 0 && (
            <>
              <DiffView entries={shown} label={`Differences between version ${version.number} and ${baseName}`} />
              {entries.length > shown.length && (
                <p className="text-[12px] text-fg-muted">
                  Showing the first {shown.length.toLocaleString("en-US")} lines of the comparison.
                </p>
              )}
            </>
          )}

          {hasUnchanged && !result.identical && (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              aria-pressed={showAll}
              className="text-[13px] text-fg-2 underline underline-offset-4 transition-colors hover:text-ember-300"
            >
              {showAll ? "Hide unchanged text" : "Show unchanged text"}
            </button>
          )}
        </>
      )}
    </div>
  );
}