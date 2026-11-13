"use client";

import { useState } from "react";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import FormAlert from "@/components/auth/FormAlert";
import {
  MAX_DESCRIPTION,
  MAX_TITLE,
  PRIORITY_OPTIONS,
  addingMessage,
  countLabel,
  draftProblems,
  includedDrafts,
  toDrafts,
  toTaskPayload,
} from "@/lib/taskDrafts";
import { createTaskRequest } from "@/services/taskService";

// The review screen for AI-proposed tasks. Every row can be changed or unticked, and nothing
// exists until "Add" is pressed. Tasks are then created one at a time, in the order shown, by
// the same endpoint as the normal "New task" form.
//   result:   { tasks, skipped } from the server.  members: who can be assigned today.
//   adding / setAdding: owned by the dialog, so it can stop being closed while tasks are added.
//   onAdded(count): everything was added.  onBack(): go back to the notes.
export default function ProposalReview({ workspaceId, members, result, truncated, adding, setAdding, onAdded, onBack }) {
  const [drafts, setDrafts] = useState(() => toDrafts(result.tasks, members));
  const [showProblems, setShowProblems] = useState(false);
  const [summary, setSummary] = useState("");

  const chosen = includedDrafts(drafts);
  const problems = draftProblems(drafts);

  function update(key, patch) {
    setDrafts((list) => list.map((draft) => (draft.key === key ? { ...draft, ...patch, error: "" } : draft)));
  }

  function setAll(include) {
    setDrafts((list) => list.map((draft) => ({ ...draft, include })));
  }

  async function addSelected() {
    if (adding || chosen.length === 0) return;

    // One blank title stops everything, so a typo can't leave you with half a list.
    if (Object.keys(problems).length > 0) {
      setShowProblems(true);
      return;
    }

    setAdding(true);
    setSummary("");

    const added = new Set();
    const failures = new Map();

    for (const draft of chosen) {
      try {
        await createTaskRequest(workspaceId, toTaskPayload(draft));
        added.add(draft.key);
      } catch (error) {
        failures.set(draft.key, error.message);
        // Offline, or signed out: the rest wouldn't work either.
        if (error.status === 0 || error.status === 401) break;
      }
    }

    // Everything is in: the dialog closes. (Nothing is set after this, since it's gone.)
    if (added.size === chosen.length) {
      onAdded(added.size);
      return;
    }

    // Keep what's left: the added ones disappear (so retrying can't duplicate them), and the
    // failed ones stay, each with its own reason.
    setDrafts((list) =>
      list
        .filter((draft) => !added.has(draft.key))
        .map((draft) => (failures.has(draft.key) ? { ...draft, error: failures.get(draft.key) } : draft))
    );
    setSummary(addingMessage({ added: added.size, failed: chosen.length - added.size }));
    setAdding(false);
  }

  if (drafts.length === 0 && !summary) {
    return (
      <div className="space-y-4">
        <p className="text-[14px] leading-relaxed text-fg-2">
          No tasks were found in these notes. Try saying who should do what, or by when.
          {result.skipped > 0 && ` (${result.skipped} suggestions couldn’t be used.)`}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="btn-ghost inline-flex items-center gap-2 rounded-control px-4 py-2 text-sm"
        >
          <ArrowLeft size={15} strokeWidth={1.5} aria-hidden="true" />
          Back to the notes
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="ai-heading">
          {countLabel(drafts.length)} proposed · {chosen.length} selected
        </h3>
        <div className="flex gap-4 text-[12px]">
          <button
            type="button"
            onClick={() => setAll(true)}
            disabled={adding}
            className="text-fg-2 underline underline-offset-4 transition-colors hover:text-ember-300"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => setAll(false)}
            disabled={adding}
            className="text-fg-2 underline underline-offset-4 transition-colors hover:text-ember-300"
          >
            Select none
          </button>
        </div>
      </div>

      <p className="ai-note">
        These are only suggestions. Change anything you like, untick what you don’t want, and nothing
        is created until you press Add.
        {truncated && " Your notes were long, so only the first part was used."}
        {result.skipped > 0 && ` ${result.skipped} suggestions couldn’t be used.`}
      </p>

      {summary && <FormAlert message={summary} />}

      <ul className="space-y-3">
        {drafts.map((draft, index) => {
          const number = index + 1;
          const problem = showProblems ? problems[draft.key] : "";

          return (
            <li key={draft.key} className={`proposal-row ${draft.include ? "" : "proposal-row-off"}`}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={draft.include}
                  onChange={(event) => update(draft.key, { include: event.target.checked })}
                  disabled={adding}
                  aria-label={`Add task ${number}`}
                  className="mt-3 size-4 shrink-0"
                  style={{ accentColor: "#EF6A45" }}
                />

                <div className="min-w-0 flex-1 space-y-2.5">
                  <input
                    type="text"
                    value={draft.title}
                    onChange={(event) => update(draft.key, { title: event.target.value })}
                    maxLength={MAX_TITLE}
                    disabled={adding}
                    aria-label={`Title for task ${number}`}
                    aria-invalid={problem ? "true" : undefined}
                    className="input"
                  />
                  {problem && <p className="text-[12px] text-danger">{problem}</p>}
                  {draft.error && <p className="text-[12px] text-danger">{draft.error}</p>}

                  <div className="flex flex-wrap gap-2.5">
                    <select
                      value={draft.priority}
                      onChange={(event) => update(draft.key, { priority: event.target.value })}
                      disabled={adding}
                      aria-label={`Priority for task ${number}`}
                      className="input input-sm"
                    >
                      {PRIORITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label} priority
                        </option>
                      ))}
                    </select>

                    <input
                      type="date"
                      value={draft.dueDate}
                      onChange={(event) => update(draft.key, { dueDate: event.target.value })}
                      disabled={adding}
                      aria-label={`Due date for task ${number}`}
                      className="input input-sm"
                    />

                    <select
                      value={draft.assigneeId}
                      onChange={(event) => update(draft.key, { assigneeId: event.target.value })}
                      disabled={adding}
                      aria-label={`Assignee for task ${number}`}
                      className="input input-sm"
                    >
                      <option value="">Unassigned</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <textarea
                    value={draft.description}
                    onChange={(event) => update(draft.key, { description: event.target.value })}
                    rows={2}
                    maxLength={MAX_DESCRIPTION}
                    disabled={adding}
                    placeholder="Details (optional)"
                    aria-label={`Details for task ${number}`}
                    className="input textarea"
                    style={{ minHeight: 56 }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          disabled={adding}
          className="btn-ghost inline-flex items-center gap-2 rounded-control px-4 py-2 text-sm"
        >
          <ArrowLeft size={15} strokeWidth={1.5} aria-hidden="true" />
          Back to the notes
        </button>

        <button
          type="button"
          onClick={addSelected}
          disabled={adding || chosen.length === 0}
          className="btn-primary inline-flex items-center gap-2 rounded-control px-5 py-2 text-sm"
        >
          {adding ? (
            <Loader2 size={15} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
          ) : (
            <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
          )}
          {adding ? "Adding…" : chosen.length === 0 ? "Select a task to add" : `Add ${countLabel(chosen.length)}`}
        </button>
      </div>
    </div>
  );
}