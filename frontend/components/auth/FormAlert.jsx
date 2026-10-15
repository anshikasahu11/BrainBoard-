import { AlertCircle } from "lucide-react";

// A form-level error, such as "Invalid email or password".
// role="alert" makes screen readers announce it when it appears.
export default function FormAlert({ message }) {
  if (!message) return null;

  return (
    <div role="alert" className="form-alert">
      <AlertCircle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}