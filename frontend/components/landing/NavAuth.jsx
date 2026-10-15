"use client";

import Link from "next/link";
import useAuth from "@/hooks/useAuth";

// The right-hand side of the landing navbar. It changes with sign-in state.
export default function NavAuth() {
  const { status } = useAuth();

  // Reserve the space while we check the token, so nothing flashes or jumps.
  if (status === "loading") {
    return <div className="h-9 w-32" aria-hidden="true" />;
  }

  if (status === "authenticated") {
    return (
      <Link
        href="/dashboard"
        className="btn-primary inline-flex items-center rounded-control px-4 py-2 text-[13px]"
      >
        Dashboard
      </Link>
    );
  }

  return (
    <>
      <Link
        href="/login"
        className="hidden text-[13px] text-fg transition-colors hover:text-ember-300 sm:inline"
      >
        Sign in
      </Link>
      <Link
        href="/register"
        className="btn-primary inline-flex items-center rounded-control px-4 py-2 text-[13px]"
      >
        Get started
      </Link>
    </>
  );
}