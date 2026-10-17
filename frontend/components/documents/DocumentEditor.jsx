"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { AlertCircle, ArrowLeft } from "lucide-react";
import Reveal from "@/components/Reveal";
import FormAlert from "@/components/auth/FormAlert";
import Toolbar from "@/components/documents/Toolbar";
import SaveIndicator from "@/components/documents/SaveIndicator";
import useWorkspace from "@/hooks/useWorkspace";
import { updateDocumentRequest } from "@/services/documentService";
import { formatDate, formatRelative } from "@/lib/format";

const AUTOSAVE_DELAY = 1500; // ms after the last keystroke
const MAX_WAIT = 10000; // while typing without pause, save at least this often
const RETRY_DELAY = 5000; // after a network failure

// initialDoc: the document as loaded from the API.
// onReload: loads the latest version from the server (discarding local edits).
export default function DocumentEditor({ initialDoc, onReload }) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.id;
  const docId = initialDoc.id;

  const [title, setTitle] = useState(initialDoc.title);
  const [status, setStatus] = useState("saved"); // saved | unsaved | saving | error
  const [saveError, setSaveError] = useState("");
  const [conflict, setConflict] = useState(null); // { currentRevision } while a conflict is open
  const [gone, setGone] = useState(false); // the document was deleted by someone else
  const [isEmpty, setIsEmpty] = useState(false);
  const [meta, setMeta] = useState({
    updatedAt: initialDoc.updatedAt,
    editor: initialDoc.lastEditedBy.name,
  });

  const titleInputRef = useRef(null);
  const editorRef = useRef(null);
  const saveRef = useRef(null);

  // Everything the save logic needs lives here, in one ref, so timers and event
  // handlers always see current values.
  const s = useRef({
    revision: initialDoc.revision, // the revision our next save is based on
    savedTitle: initialDoc.title,
    title: initialDoc.title,
    dirty: { title: false, content: false }, // changed since the last successful save
    versions: { title: 0, content: 0 }, // bumped on each edit, to notice edits made mid-save
    saving: false,
    blocked: false, // true during a conflict or after the document was deleted
    mounted: true,
    debounce: null,
    max: null,
    retry: null,
  });

  const clearTimers = useCallback(() => {
    const state = s.current;
    clearTimeout(state.debounce);
    clearTimeout(state.max);
    clearTimeout(state.retry);
    state.debounce = state.max = state.retry = null;
  }, []);

  const scheduleSave = useCallback((delay) => {
    const state = s.current;
    if (!state.mounted || state.blocked) return;

    clearTimeout(state.debounce);
    clearTimeout(state.retry);
    state.debounce = setTimeout(() => saveRef.current?.(), delay);
    if (!state.max) state.max = setTimeout(() => saveRef.current?.(), MAX_WAIT);
  }, []);

  const save = useCallback(async () => {
    const state = s.current;
    clearTimers();
    if (state.saving || state.blocked) return;

    const editor = editorRef.current;
    const trimmedTitle = state.title.trim();

    // Typed the title back to the saved value: nothing to send.
    if (state.dirty.title && trimmedTitle === state.savedTitle) state.dirty.title = false;

    // A blank title can't be saved, so wait until there's one.
    const titleChanged = state.dirty.title && trimmedTitle !== "";
    const contentChanged = state.dirty.content && Boolean(editor);

    if (!titleChanged && !contentChanged) {
      if (!state.dirty.title && !state.dirty.content) setStatus("saved");
      return;
    }

    const body = { baseRevision: state.revision };
    if (titleChanged) body.title = trimmedTitle;
    if (contentChanged) {
      try {
        body.content = editor.getJSON();
      } catch {
        return; // the editor is already gone, so there's nothing left to read
      }
    }
    const sent = { title: state.versions.title, content: state.versions.content };

    state.saving = true;
    setStatus("saving");
    setSaveError("");

    try {
      const { document: saved } = await updateDocumentRequest(workspaceId, docId, body);

      state.revision = saved.revision;
      state.savedTitle = saved.title;
      // Only mark clean if nothing changed while the request was in flight.
      if (titleChanged && state.versions.title === sent.title) state.dirty.title = false;
      if (contentChanged && state.versions.content === sent.content) state.dirty.content = false;

      setMeta({ updatedAt: saved.updatedAt, editor: saved.lastEditedBy.name });

      const more = state.dirty.title || state.dirty.content;
      setStatus(more ? "unsaved" : "saved");
      if (more) {
        if (state.mounted) scheduleSave(AUTOSAVE_DELAY);
        else saveRef.current?.(); // we left the page mid-save: send what was typed since
      }
    } catch (error) {
      if (error.status === 409) {
        // Someone else saved a newer version first. Stop and let the user choose.
        state.blocked = true;
        setConflict({ currentRevision: error.errors?.currentRevision ?? null });
        setStatus("error");
      } else if (error.status === 404) {
        state.blocked = true;
        setGone(true);
        setSaveError("This document was deleted, so your latest changes can't be saved.");
        setStatus("error");
      } else if (error.status === 401) {
        // apiFetch has already signed us out.
      } else if (error.status === 0 || error.status >= 500) {
        setSaveError("Couldn't reach the server. Trying again in a few seconds…");
        setStatus("error");
        if (state.mounted) state.retry = setTimeout(() => saveRef.current?.(), RETRY_DELAY);
      } else {
        // Rejected (for example too large, or content that isn't valid). Show why.
        setSaveError(error.message);
        setStatus("error");
      }
    } finally {
      state.saving = false;
    }
  }, [clearTimers, scheduleSave, workspaceId, docId]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const markDirty = useCallback(
    (part) => {
      const state = s.current;
      state.dirty[part] = true;
      state.versions[part] += 1;
      if (state.blocked) return;

      setSaveError("");
      setStatus((current) => (current === "saving" ? current : "unsaved"));
      scheduleSave(AUTOSAVE_DELAY);
    },
    [scheduleSave]
  );

  const editor = useEditor({
    // Tiptap must not render on the server (it would mismatch the browser).
    immediatelyRender: false,
    extensions: [
      // Only the formats the server accepts: headings 1 to 3, lists, quotes,
      // code, links... plus checklists below.
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: initialDoc.content,
    editorProps: {
      attributes: { "aria-label": "Document content" },
    },
    onCreate: ({ editor: created }) => setIsEmpty(created.isEmpty),
    onUpdate: ({ editor: updated }) => {
      setIsEmpty(updated.isEmpty);
      markDirty("content");
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Listeners and cleanup: save when you switch tabs or leave, Ctrl+S, and a
  // warning if you close the tab with unsaved changes.
  useEffect(() => {
    const state = s.current;
    state.mounted = true;

    const hasPending = () => state.dirty.title || state.dirty.content;
    const flush = () => {
      if (hasPending() && !state.blocked) saveRef.current?.();
    };

    function onVisibility() {
      if (document.visibilityState === "hidden") flush();
    }
    function onBeforeUnload(event) {
      if (hasPending() || state.saving) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    function onKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveRef.current?.();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKeyDown);

      // Leaving the page (for example "All documents"): save what's pending.
      flush();
      state.mounted = false;
      clearTimers();
    };
  }, [clearTimers]);

  // A brand-new document: put the cursor in the title, ready to name it.
  useEffect(() => {
    if (initialDoc.revision === 0 && initialDoc.title === "Untitled") {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTitleChange(event) {
    const value = event.target.value;
    setTitle(value);
    s.current.title = value;
    markDirty("title");
  }

  // A document can't have an empty title, so put the saved one back.
  function handleTitleBlur() {
    const state = s.current;
    if (state.title.trim() === "") {
      state.title = state.savedTitle;
      state.dirty.title = false;
      setTitle(state.savedTitle);
    }
  }

  function handleTitleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      editor?.commands.focus("start");
    }
  }

  // Conflict, choice 2: keep my version and save it over theirs.
  function overwrite() {
    if (conflict?.currentRevision == null) {
      onReload();
      return;
    }
    const state = s.current;
    state.revision = conflict.currentRevision;
    state.blocked = false;
    setConflict(null);
    save();
  }

  const indicator = conflict ? "conflict" : status;

  return (
    <Reveal level="subtle">
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href={`/workspaces/${workspaceId}/documents`}
            className="inline-flex items-center gap-2 text-[13px] text-fg-2 transition-colors hover:text-ember-300"
          >
            <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" />
            All documents
          </Link>
          <SaveIndicator status={indicator} onRetry={status === "error" && !gone ? save : undefined} />
        </div>

        {conflict && (
          <div role="alert" className="banner-warn mb-6">
            <AlertCircle size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-amber" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[14px] font-medium">Someone else saved a newer version.</p>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-2">
                Your changes aren&apos;t saved yet, but they&apos;re still on this screen. Load the
                latest version (your unsaved changes will be lost), or save yours over theirs.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onReload}
                  className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-[13px]"
                >
                  Load latest version
                </button>
                <button
                  type="button"
                  onClick={overwrite}
                  className="btn-primary inline-flex items-center rounded-control px-4 py-2 text-[13px]"
                >
                  Save mine anyway
                </button>
              </div>
            </div>
          </div>
        )}

        {status === "error" && saveError && !conflict && (
          <div className="mb-6 space-y-3">
            <FormAlert message={saveError} />
            {gone && (
              <Link
                href={`/workspaces/${workspaceId}/documents`}
                className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-[13px]"
              >
                Back to documents
              </Link>
            )}
          </div>
        )}

        <input
          ref={titleInputRef}
          value={title}
          onChange={handleTitleChange}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          maxLength={120}
          placeholder="Untitled"
          autoComplete="off"
          aria-label="Document title"
          className="title-input"
        />

        <p className="mb-6 mt-3 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
          Created {formatDate(initialDoc.createdAt)} by {initialDoc.createdBy.name} · Edited{" "}
          {formatRelative(meta.updatedAt)} by {meta.editor}
        </p>

        <Toolbar editor={editor} />

        <div className="editor-card">
          {!editor && <div className="skeleton m-6 h-48 rounded-card" role="status" />}
          <EditorContent editor={editor} className="editor-content" />
          {editor && isEmpty && (
            <p className="editor-hint" aria-hidden="true">
              Start writing…
            </p>
          )}
        </div>
      </div>
    </Reveal>
  );
}