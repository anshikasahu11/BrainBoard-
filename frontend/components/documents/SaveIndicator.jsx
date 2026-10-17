import { AlertCircle, Check, Circle, Loader2 } from "lucide-react";

const VIEWS = {
  saved: { text: "Saved", icon: Check, tone: "text-success" },
  unsaved: { text: "Unsaved changes", icon: Circle, tone: "text-fg-2" },
  saving: { text: "Saving…", icon: Loader2, tone: "text-fg-2", spin: true },
  error: { text: "Not saved", icon: AlertCircle, tone: "text-danger" },
  conflict: { text: "Not saved · conflict", icon: AlertCircle, tone: "text-danger" },
};

// Shows where your changes are. Routine states (saving, saved) stay silent for
// screen readers, so they aren't announced every few seconds. Problems are announced.
export default function SaveIndicator({ status, onRetry }) {
  const view = VIEWS[status] ?? VIEWS.saved;
  const Icon = view.icon;
  const problem = status === "error" || status === "conflict";

  return (
    <div className="flex items-center gap-3">
      <p
        role="status"
        aria-live={problem ? "assertive" : "off"}
        className={`flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] ${view.tone}`}
      >
        <Icon
          size={13}
          strokeWidth={1.75}
          className={view.spin ? "animate-spin" : ""}
          aria-hidden="true"
        />
        {view.text}
      </p>

      {status === "error" && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-[12px] text-fg-2 underline underline-offset-4 transition-colors hover:text-ember-300"
        >
          Retry now
        </button>
      )}
    </div>
  );
}