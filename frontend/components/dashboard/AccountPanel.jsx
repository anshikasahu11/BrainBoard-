"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import Logo from "@/components/Logo";
import Reveal from "@/components/Reveal";
import useAuth from "@/hooks/useAuth";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-6 border-t border-line py-3.5 first:border-t-0">
      <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">{label}</dt>
      <dd className="min-w-0 truncate text-sm text-fg">{children}</dd>
    </div>
  );
}

export default function AccountPanel() {
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace("/");
  }

  const firstName = user.name.split(" ")[0];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-void/40 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />
          <button
            type="button"
            onClick={handleLogout}
            className="btn-ghost inline-flex items-center gap-2 rounded-control px-3.5 py-2 text-[13px]"
          >
            <LogOut size={15} strokeWidth={1.5} aria-hidden="true" />
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-20">
        <Reveal level="balanced">
          <p className="eyebrow mb-4">
            <span className="size-1.5 rounded-full bg-ember-300" />
            Signed in
          </p>
        </Reveal>

        <Reveal level="balanced" delay={0.1}>
          <h1 className="text-glow font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            Welcome back, {firstName}.
          </h1>
        </Reveal>

        <Reveal level="balanced" delay={0.25} className="mt-10">
          <div className="glass rounded-card p-6">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-2">
              Account
            </p>
            <dl>
              <Row label="Name">{user.name}</Row>
              <Row label="Email">{user.email}</Row>
              <Row label="Member since">{formatDate(user.createdAt)}</Row>
              <Row label="ID">
                <span className="font-mono text-xs text-fg-2">{user.id}</span>
              </Row>
            </dl>
          </div>
        </Reveal>
      </main>
    </>
  );
}