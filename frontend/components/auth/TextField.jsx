"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// A labelled input with an error message, an optional hint, and (for
// type="password") a show/hide button.
export default function TextField({
  label,
  name,
  type = "text",
  value,
  onChange,
  error,
  hint,
  placeholder,
  autoComplete,
  autoFocus = false,
  disabled = false,
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] text-fg-2">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          name={name}
          type={isPassword && visible ? "text" : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          disabled={disabled}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={messageId}
          className={`input ${isPassword ? "pr-11" : ""}`}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-control text-fg-muted transition-colors hover:text-fg"
          >
            {visible ? (
              <EyeOff size={16} strokeWidth={1.5} />
            ) : (
              <Eye size={16} strokeWidth={1.5} />
            )}
          </button>
        )}
      </div>

      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[12px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[12px] text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}