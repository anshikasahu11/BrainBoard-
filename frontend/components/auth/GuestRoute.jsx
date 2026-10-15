"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/hooks/useAuth";
import FullScreenLoader from "@/components/ui/FullScreenLoader";

// Wrap the login and register pages (used in Step 3).
// Signed-in users have no reason to see them, so send them to the dashboard.
export default function GuestRoute({ children }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  if (status !== "unauthenticated") return <FullScreenLoader />;
  return children;
}