"use client";

import { useId, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import TextField from "@/components/auth/TextField";
import FormAlert from "@/components/auth/FormAlert";
import { LANGUAGES, MAX_CODE_LENGTH, MAX_TAGS, parseTags, sameList } from "@/lib/snippets";
import { createSnippetRequest, updateSnippetRequest } from "@/services/snippetService";

// snippet: the FULL snippet being edited (with its code), or undefined to create one.
// Mount it only while it's open: that also resets the form each time.
export default function SnippetForm({ snippet, workspaceId, onSaved, onGone, onReload, onClose }) {
  const editing = Boolean(snippet);
  const baseId = useId();
  const id = (name) => `${baseId}-${name}`;

  // What the form started with. Used to work out what the user actually changed.
  const [initial] = useState(() => ({
    title: snippet?.title ?? "",
    description: snippet?.description ?? "",
    language: snippet?.language ?? "javascript",
    tags: snippet?.tags ?? [],
    code: snippet?.code ?? "",
  }));

  const [values, setValues] = useState(() => ({ ...initial, tags: initial.tags.join(", ") }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(null); // { currentRevision } while a conflict is open
  const [discarding, setDiscarding] = useState(false);

  // The revision our save is based on. "Save mine anyway" moves it forward.
  const revisionRef = useRef(snippet?.revision ?? 0);

  function change(name) {
    return (event) => {
      const value = event.target.value;
      setValues((current) => ({ ...current, [name]: value }));
      if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }));
    };
  }

  function isDirty() {
    return (
      values.title.trim() !== initial.title ||
      values.description.trim() !== initial.description ||
      values.language !== initial.language ||
      !sameList(parseTags(values.tags), initial.tags) ||
      values.code !== initial.code
    );
  }

  // Esc, the backdrop and Cancel all come through here: ask before throwing work away.
  function requestClose() {
    if (busy) return;
    if (isDirty()) setDiscarding(true);
    else onClose();
  }

  async function submit() {
    if (busy) return;

    const title = values.title.trim();
    const description = values.description.trim();
    const tags = parseTags(values.tags);

    let request;
    if (editing) {
      // Send ONLY what changed, so a teammate's edit to another field survives.
      const changes = {};
      if (title !== initial.title) changes.title = title;
      if (description !== initial.description) changes.description = description;
      if (values.language !== initial.language) changes.language = values.language;
      if (!sameList(tags, initial.tags)) changes.tags = tags;
      if (values.code !== initial.code) changes.code = values.code;

      if (Object.keys(changes).length === 0) {
        onClose(); // nothing changed, nothing to save
        return;
      }
      request = () =>
        updateSnippetRequest(workspaceId, snippet.id, {
          ...changes,
          baseRevision: revisionRef.current,
        });
    } else {
      request = () =>
        createSnippetRequest(workspaceId, {
          title,
          description,
          language: values.language,
          tags,
          code: values.code,
        });
    }

    setBusy(true);
    setErrors({});
    setFormError("");
    setConflict(null);

    try {
      const { snippet: saved } = await request();
      onSaved(saved, editing ? "updated" : "created");
    } catch (error) {
      if (editing && error.status === 409) {
        // Someone else saved first. Stop and let the user choose.
        setConflict({ currentRevision: error.errors?.currentRevision ?? null });
      } else if (editing && error.status === 404) {
        onGone(); // someone else deleted it while you were editing
        return;
      } else if (error.errors) {
        setErrors(error.errors);
      } else {
        setFormError(error.message);
      }
      setBusy(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    submit();
  }

  // Conflict, choice 2: keep my changes and save them over theirs.
  function saveMineAnyway() {
    if (conflict?.currentRevision == null) {
      onReload(snippet.id);
      return;
    }
    revisionRef.current = conflict.currentRevision;
    setConflict(null);
    submit();
  }

  const codeTooLong = values.code.length > MAX_CODE_LENGTH;

  return (
    <Modal title={editing ? "Edit snippet" : "New snippet"} onClose={requestClose} busy={busy} size="lg">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {conflict && (
          <div role="alert" className="banner-warn">
            <AlertCircle size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-amber" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[14px] font-medium">Someone else changed this snippet.</p>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-2">
                Your changes aren&apos;t saved yet, but they&apos;re still on this screen. Load the
                latest version (your unsaved changes will be lost), or save yours over theirs.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onReload(snippet.id)}
                  className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-[13px]"
                >
                  Load latest version
                </button>
                <button
                  type="button"
                  onClick={saveMineAnyway}
                  className="btn-primary inline-flex items-center rounded-control px-4 py-2 text-[13px]"
                >
                  Save mine anyway
                </button>
              </div>
            </div>
          </div>
        )}

        <FormAlert message={formError} />

        <TextField
          label="Title"
          name="title"
          value={values.title}
          onChange={change("title")}
          error={errors.title}
          placeholder="e.g. Verify a JWT"
          autoComplete="off"
          disabled={busy}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={id("language")} className="mb-1.5 block text-[13px] text-fg-2">
              Language
            </label>
            <select
              id={id("language")}
              value={values.language}
              onChange={change("language")}
              disabled={busy}
              aria-invalid={errors.language ? "true" : undefined}
              aria-describedby={errors.language ? id("language-error") : undefined}
              className="input"
            >
              {LANGUAGES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {errors.language && (
              <p id={id("language-error")} className="mt-1.5 text-[12px] text-danger">
                {errors.language}
              </p>
            )}
          </div>

          <TextField
            label="Tags"
            name="tags"
            value={values.tags}
            onChange={change("tags")}
            error={errors.tags}
            hint={`Separate with commas. Up to ${MAX_TAGS}.`}
            placeholder="auth, jwt"
            autoComplete="off"
            disabled={busy}
          />
        </div>

        <div>
          <label htmlFor={id("description")} className="mb-1.5 block text-[13px] text-fg-2">
            Description <span className="text-fg-muted">(optional)</span>
          </label>
          <textarea
            id={id("description")}
            value={values.description}
            onChange={change("description")}
            rows={2}
            maxLength={1000}
            disabled={busy}
            aria-invalid={errors.description ? "true" : undefined}
            aria-describedby={errors.description ? id("description-error") : undefined}
            className="input textarea"
          />
          {errors.description && (
            <p id={id("description-error")} className="mt-1.5 text-[12px] text-danger">
              {errors.description}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={id("code")} className="mb-1.5 block text-[13px] text-fg-2">
            Code
          </label>
          <textarea
            id={id("code")}
            value={values.code}
            onChange={change("code")}
            rows={12}
            wrap="off"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            disabled={busy}
            aria-invalid={errors.code ? "true" : undefined}
            aria-describedby={errors.code ? id("code-error") : id("code-count")}
            className="input textarea code-textarea"
          />
          <div className="mt-1.5 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            {errors.code ? (
              <p id={id("code-error")} className="text-[12px] text-danger">
                {errors.code}
              </p>
            ) : (
              <span />
            )}
            <p
              id={id("code-count")}
              className={`font-mono text-[11px] ${codeTooLong ? "text-danger" : "text-fg-muted"}`}
            >
              {values.code.length.toLocaleString("en-US")} / {MAX_CODE_LENGTH.toLocaleString("en-US")}
            </p>
          </div>
        </div>

        {discarding ? (
          <div className="rounded-card border border-danger/40 bg-scorched/60 p-4">
            <p className="text-[14px]">Discard your changes?</p>
            <p className="mt-1 text-[13px] text-fg-2">What you&apos;ve typed here won&apos;t be saved.</p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDiscarding(false)}
                className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
              >
                Keep editing
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
        ) : (
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={requestClose}
              disabled={busy}
              className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="btn-primary inline-flex items-center gap-2 rounded-control px-5 py-2 text-sm"
            >
              {busy && (
                <Loader2 size={15} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
              )}
              {busy ? "Saving…" : editing ? "Save changes" : "Create snippet"}
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}