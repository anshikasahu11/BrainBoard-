"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/hooks/useAuth";
import FullScreenLoader from "@/components/ui/FullScreenLoader";
import { safeNext } from "@/lib/redirect";

// Wraps the login and register pages. Once a user is signed in, whether they
// just logged in or were already signed in, they're sent to the page they
// were heading for (?next=) or to the dashboard.
export default function GuestRoute({ children }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(safeNext(next));
    }
  }, [status, router]);

  if (status !== "unauthenticated") return <FullScreenLoader />;
  return children;
}