"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import Logo from "@/components/Logo";
import useAuth from "@/hooks/useAuth";

// The top bar for signed-in pages: logo, your name, and log out.
export default function AppHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-void/40 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />

        <div className="flex items-center gap-4">
          <span className="hidden text-[13px] text-fg-2 sm:inline">{user.name}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="btn-ghost inline-flex items-center gap-2 rounded-control px-3.5 py-2 text-[13px]"
          >
            <LogOut size={15} strokeWidth={1.5} aria-hidden="true" />
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}