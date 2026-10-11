import Link from "next/link";

export default function Logo({ className = "" }) {
  return (
    <Link
      href="/"
      className={`flex items-center gap-2 ${className}`}
      aria-label="BrainBoard home"
    >
      <span className="logo-orb" aria-hidden="true" />
      <span className="text-[15px] font-medium">BrainBoard</span>
    </Link>
  );
}