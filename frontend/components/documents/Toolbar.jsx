"use client";

import { Fragment, useEffect, useReducer, useState } from "react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Undo2,
} from "lucide-react";
import LinkBar from "@/components/documents/LinkBar";

// Each tool: what it does (run) and how to tell it's active.
const GROUPS = [
  [
    { key: "h1", label: "Heading 1", icon: Heading1, run: (c) => c.toggleHeading({ level: 1 }), active: (e) => e.isActive("heading", { level: 1 }) },
    { key: "h2", label: "Heading 2", icon: Heading2, run: (c) => c.toggleHeading({ level: 2 }), active: (e) => e.isActive("heading", { level: 2 }) },
    { key: "h3", label: "Heading 3", icon: Heading3, run: (c) => c.toggleHeading({ level: 3 }), active: (e) => e.isActive("heading", { level: 3 }) },
  ],
  [
    { key: "bold", label: "Bold", hint: "Ctrl+B", icon: Bold, run: (c) => c.toggleBold(), active: (e) => e.isActive("bold") },
    { key: "italic", label: "Italic", hint: "Ctrl+I", icon: Italic, run: (c) => c.toggleItalic(), active: (e) => e.isActive("italic") },
    { key: "strike", label: "Strikethrough", icon: Strikethrough, run: (c) => c.toggleStrike(), active: (e) => e.isActive("strike") },
    { key: "code", label: "Inline code", icon: Code, run: (c) => c.toggleCode(), active: (e) => e.isActive("code") },
  ],
  [
    { key: "bullets", label: "Bullet list", icon: List, run: (c) => c.toggleBulletList(), active: (e) => e.isActive("bulletList") },
    { key: "numbers", label: "Numbered list", icon: ListOrdered, run: (c) => c.toggleOrderedList(), active: (e) => e.isActive("orderedList") },
    { key: "tasks", label: "Checklist", icon: ListTodo, run: (c) => c.toggleTaskList(), active: (e) => e.isActive("taskList") },
  ],
  [
    { key: "quote", label: "Quote", icon: Quote, run: (c) => c.toggleBlockquote(), active: (e) => e.isActive("blockquote") },
    { key: "codeblock", label: "Code block", icon: SquareCode, run: (c) => c.toggleCodeBlock(), active: (e) => e.isActive("codeBlock") },
  ],
];

function ToolButton({ label, hint, icon: Icon, active, expanded, disabled, onClick }) {
  return (
    <button
      type="button"
      // Don't let the click move focus out of the editor (it would lose the selection).
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      aria-expanded={expanded}
      title={hint ? `${label} (${hint})` : label}
      className={`tool-btn ${active ? "tool-btn-active" : ""}`}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

const Separator = () => <span className="toolbar-sep" aria-hidden="true" />;

export default function Toolbar({ editor }) {
  const [linkOpen, setLinkOpen] = useState(false);

  // Re-render on every editor change, so "active" highlights follow the cursor.
  const [, rerender] = useReducer((count) => count + 1, 0);
  useEffect(() => {
    if (!editor) return;
    editor.on("transaction", rerender);
    return () => editor.off("transaction", rerender);
  }, [editor]);

  if (!editor) {
    return (
      <div className="toolbar-wrap">
        <div className="skeleton h-[46px] rounded-card" />
      </div>
    );
  }

  return (
    <div className="toolbar-wrap">
      <div className="toolbar" role="toolbar" aria-label="Formatting">
        {GROUPS.map((group, index) => (
          <Fragment key={index}>
            {index > 0 && <Separator />}
            {group.map((tool) => (
              <ToolButton
                key={tool.key}
                label={tool.label}
                hint={tool.hint}
                icon={tool.icon}
                active={tool.active(editor)}
                onClick={() => tool.run(editor.chain().focus()).run()}
              />
            ))}
          </Fragment>
        ))}

        <Separator />
        <ToolButton
          label="Link"
          icon={LinkIcon}
          active={editor.isActive("link")}
          expanded={linkOpen}
          onClick={() => setLinkOpen((open) => !open)}
        />

        <Separator />
        <ToolButton
          label="Undo"
          hint="Ctrl+Z"
          icon={Undo2}
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolButton
          label="Redo"
          hint="Ctrl+Shift+Z"
          icon={Redo2}
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>

      {linkOpen && <LinkBar editor={editor} onClose={() => setLinkOpen(false)} />}
    </div>
  );
}