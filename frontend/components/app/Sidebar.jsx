"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import Logo from "@/components/Logo";
import WorkspaceSwitcher from "@/components/app/WorkspaceSwitcher";
import { NAV_ITEMS } from "@/components/app/navItems";
import useAuth from "@/hooks/useAuth";
import useWorkspace from "@/hooks/useWorkspace";

const GROUPS = [
  { key: "work", label: "Workspace" },
  { key: "manage", label: "Manage" },
];

// Shared by the desktop sidebar and the mobile drawer.
// onNavigate lets the drawer close itself when you pick something.
export default function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth();
  const { workspace } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();

  const base = `/workspaces/${workspace.id}`;

  function handleLogout() {
    onNavigate?.();
    logout();
    router.replace("/");
  }

  function renderItem(item) {
    const Icon = item.icon;

    // Not built yet: shown dimmed and NOT as a link, so keyboard users can't land on it.
    if (item.soon) {
      return (
        <li key={item.key}>
          <span className="nav-item nav-item-soon" aria-disabled="true">
            <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
            {item.label}
            <span className="nav-soon">Soon</span>
          </span>
        </li>
      );
    }

    const href = `${base}${item.path ?? ""}`;

    // A section stays highlighted on its nested pages (a single document keeps
    // "Documents" lit). The dashboard has no nested pages, so it's exact only.
    const active = item.path
      ? pathname === href || pathname.startsWith(`${href}/`)
      : pathname === href;

    return (
      <li key={item.key}>
        <Link
          href={href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={`nav-item ${active ? "nav-item-active" : ""}`}
        >
          <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
          {item.label}
        </Link>
      </li>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-6 p-4">
      <Logo className="px-2 pt-1" />

      <WorkspaceSwitcher onNavigate={onNavigate} />

      <nav aria-label="Workspace" className="flex-1 space-y-6">
        {GROUPS.map((group) => (
          <div key={group.key}>
            <p className="mb-2 px-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {NAV_ITEMS.filter((item) => item.group === group.key).map(renderItem)}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line pt-4">
        <div className="flex items-center gap-3">
          <span className="avatar" aria-hidden="true">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px]">{user.name}</p>
            <p className="truncate text-[12px] text-fg-muted">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Log out"
            className="grid size-8 shrink-0 place-items-center rounded-control text-fg-2 transition-colors hover:bg-white/10 hover:text-fg"
          >
            <LogOut size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}