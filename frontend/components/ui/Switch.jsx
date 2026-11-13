"use client";

// An on/off switch. It's a real button with role="switch", so keyboards (Space or Enter) and
// screen readers treat it as one. labelledBy and describedBy point at the text next to it.
export default function Switch({ checked, onChange, disabled = false, labelledBy, describedBy }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`switch ${checked ? "switch-on" : ""}`}
    >
      <span className="switch-thumb" aria-hidden="true" />
    </button>
  );
}