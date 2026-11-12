"use client";

import { useSyncExternalStore } from "react";
import { Search } from "lucide-react";
import useSearch from "@/hooks/useSearch";

const subscribe = () => () => {};
const isApple = () => /Mac|iPhone|iPad/.test(navigator.userAgentData?.platform ?? navigator.platform ?? "");

// Opens the search window.
//   compact:    just an icon (the mobile top bar)
//   onNavigate: closes the mobile menu first, when the button sits inside it
export default function SearchButton({ compact = false, onNavigate }) {
  const { open } = useSearch();

  // The right shortcut for this computer, with no flash of the wrong one while loading.
  const mac = useSyncExternalStore(subscribe, isApple, () => false);
  const shortcut = mac ? "⌘K" : "Ctrl K";

  if (compact) {
    return (
      <button
        type="button"
        onClick={open}
        aria-label="Search"
        aria-keyshortcuts="Control+K Meta+K"
        className="grid size-9 place-items-center rounded-control text-fg transition-colors hover:bg-white/10"
      >
        <Search size={18} strokeWidth={1.5} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        onNavigate?.();
        open();
      }}
      aria-keyshortcuts="Control+K Meta+K"
      className="search-trigger"
    >
      <Search size={15} strokeWidth={1.5} aria-hidden="true" />
      <span className="flex-1 text-left">Search</span>
      <kbd className="kbd" aria-hidden="true">
        {shortcut}
      </kbd>
    </button>
  );
}