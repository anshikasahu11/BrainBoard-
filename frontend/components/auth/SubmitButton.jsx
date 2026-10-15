import { Loader2 } from "lucide-react";

export default function SubmitButton({ loading, loadingText, children }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="btn-primary inline-flex h-11 w-full items-center justify-center gap-2 rounded-control text-sm"
    >
      {loading && (
        <Loader2 size={16} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
      )}
      {loading ? loadingText : children}
    </button>
  );
}