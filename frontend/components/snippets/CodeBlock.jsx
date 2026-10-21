"use client";

import { useEffect, useState } from "react";
import { languageInfo } from "@/lib/snippets";

// The highlighter is loaded once, the first time it's needed, so it isn't part
// of the page's main download.
let lowlightPromise = null;
function loadLowlight() {
  if (!lowlightPromise) {
    lowlightPromise = import("lowlight")
      .then(({ common, createLowlight }) => createLowlight(common))
      .catch((error) => {
        lowlightPromise = null; // allow another try next time
        throw error;
      });
  }
  return lowlightPromise;
}

// The highlighter returns a tree of text and coloured pieces. We turn it into
// ordinary React elements, so no HTML string is ever put into the page.
function renderNode(node, key) {
  if (node.type === "text") return node.value;

  if (node.type === "element") {
    const classes = node.properties?.className;
    return (
      <span key={key} className={Array.isArray(classes) ? classes.join(" ") : undefined}>
        {node.children.map((child, index) => renderNode(child, index))}
      </span>
    );
  }

  return null;
}

// Shows code with colours. Until the highlighter arrives (or if it can't handle
// the code), the plain text is shown, so the code is always readable.
// scrollable: lets keyboard users focus the box and scroll it.
export default function CodeBlock({ code, language, label, scrollable = false, className = "" }) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;

    loadLowlight()
      .then((lowlight) => {
        if (cancelled) return;

        const name = languageInfo(language).hljs;
        if (!lowlight.registered(name)) return;

        setResult({ code, language, nodes: lowlight.highlight(name, code).children });
      })
      .catch(() => {
        // The highlighter is unavailable or the code confused it: the plain text stays.
      });

    return () => {
      cancelled = true;
    };
  }, [code, language]);

  // Only use a result that belongs to the code on screen right now.
  const ready = result && result.code === code && result.language === language;

  return (
    <pre
      className={`code-block ${className}`}
      {...(scrollable ? { tabIndex: 0, role: "region", "aria-label": label } : {})}
    >
      <code>{ready ? result.nodes.map((node, index) => renderNode(node, index)) : code}</code>
    </pre>
  );
}