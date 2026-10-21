"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Copy } from "lucide-react";
import { copyText } from "@/lib/snippets";

const VIEWS = {
  idle: { text: "Copy", icon: Copy, tone: "text-fg-2 hover:text-fg" },
  copied: { text: "Copied", icon: Check, tone: "text-success" },
  failed: { text: "Couldn’t copy", icon: AlertCircle, tone: "text-danger" },
};

// getText: returns the text to copy, or a promise for it (a card fetches the full
// code at the moment you click). subject: what's being copied, for screen readers.
export default function CopyButton({ getText, subject, className = "" }) {
  const [state, setState] = useState("idle"); // idle | copied | failed
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function handleClick() {
    clearTimeout(timer.current);
    try {
      await copyText(getText());
      setState("copied");
    } catch {
      setState("failed");
    }
    timer.current = setTimeout(() => setState("idle"), 2200);
  }

  const view = VIEWS[state];
  const Icon = view.icon;

  return (
    <>
      <button type="button" onClick={handleClick} className={`copy-btn ${view.tone} ${className}`}>
        <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
        {view.text}
        <span className="sr-only"> code from {subject}</span>
      </button>

      {/* Announces the result to screen readers, without moving focus. */}
      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied" && `Copied ${subject} to the clipboard.`}
        {state === "failed" && "Couldn’t copy to the clipboard."}
      </span>
    </>
  );
}