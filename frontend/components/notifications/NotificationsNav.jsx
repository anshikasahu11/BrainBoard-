"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The two views of notifications: the list, and the settings.
export default function NotificationsNav({ workspaceId }) {
  const pathname = usePathname();
  const base = `/workspaces/${workspaceId}/notifications`;

  const tabs = [
    { href: base, label: "All notifications" },
    { href: `${base}/settings`, label: "Settings" },
  ];

  return (
    <nav aria-label="Notifications" className="seg">
      {tabs.map((tab) => {
        const active = pathname === tab.href;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`seg-btn ${active ? "seg-btn-active" : ""}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}