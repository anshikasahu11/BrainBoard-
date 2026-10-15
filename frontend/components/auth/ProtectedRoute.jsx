"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import useAuth from "@/hooks/useAuth";
import FullScreenLoader from "@/components/ui/FullScreenLoader";

// Wrap any page that needs a signed-in user. Signed-out visitors are sent to
// /login and remember where they were headed. This is a convenience for users.
// The real protection is the backend, which rejects every unauthenticated API call.
export default function ProtectedRoute({ children }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status !== "authenticated") return <FullScreenLoader />;
  return children;
}