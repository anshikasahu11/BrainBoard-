"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { createEditorExtensions } from "@/lib/editorExtensions";

// Shows a document's content exactly as the editor would, but nobody can change it.
// It's built from the editor's own content (never raw HTML), so nothing is injected into the page.
export default function ReadOnlyDocument({ content, label }) {
  const editor = useEditor({
    // Tiptap must not render on the server (it would mismatch the browser).
    immediatelyRender: false,
    editable: false,
    extensions: createEditorExtensions(),
    content,
    editorProps: { attributes: { "aria-label": label } },
  });

  if (!editor) return <div className="skeleton m-4 h-24 rounded-card" role="status" />;

  return <EditorContent editor={editor} className="editor-content readonly-doc" />;
}