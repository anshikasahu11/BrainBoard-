"use client";

import { useEffect, useRef, useState } from "react";

// Only web and email links are kept (the server enforces the same rule).
function normalize(raw) {
  let url = raw.trim();
  if (!url) return null;

  // No protocol typed: "name@site.com" becomes an email link, anything else becomes https://
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    url = url.includes("@") && !url.includes("/") ? `mailto:${url}` : `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol) ? url : null;
  } catch {
    return null;
  }
}

export default function LinkBar({ editor, onClose }) {
  const existing = editor.getAttributes("link").href ?? "";
  const [value, setValue] = useState(existing);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function close() {
    onClose();
    editor.commands.focus();
  }

  function apply(event) {
    event.preventDefault();

    const href = normalize(value);
    if (!href) {
      setError("Enter a web address or an email address.");
      return;
    }

    const { empty } = editor.state.selection;
    if (empty && !editor.isActive("link")) {
      // Nothing selected: insert the address itself as a link.
      editor
        .chain()
        .focus()
        .insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] })
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    onClose();
  }

  function remove() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    onClose();
  }

  return (
    <form
      onSubmit={apply}
      noValidate
      onKeyDown={(event) => event.key === "Escape" && close()}
      className="link-bar"
    >
      <label htmlFor="link-url" className="sr-only">
        Link address
      </label>
      <input
        id="link-url"
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          if (error) setError("");
        }}
        placeholder="https://example.com"
        autoComplete="off"
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? "link-url-error" : undefined}
        className="input input-sm min-w-0 flex-1"
      />

      <button type="submit" className="btn-primary h-9 rounded-control px-4 text-[13px]">
        {existing ? "Update" : "Add link"}
      </button>

      {existing && (
        <>
          <a
            href={existing}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost inline-flex h-9 items-center rounded-control px-3 text-[13px]"
          >
            Open
          </a>
          <button
            type="button"
            onClick={remove}
            className="btn-ghost h-9 rounded-control px-3 text-[13px]"
          >
            Remove
          </button>
        </>
      )}

      <button
        type="button"
        onClick={close}
        className="h-9 rounded-control px-3 text-[13px] text-fg-2 transition-colors hover:text-fg"
      >
        Cancel
      </button>

      {error && (
        <p id="link-url-error" role="alert" className="basis-full text-[12px] text-danger">
          {error}
        </p>
      )}
    </form>
  );
}