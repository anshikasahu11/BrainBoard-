"use client";

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import SearchDialog from "@/components/search/SearchDialog";
import { isSearchShortcut } from "@/lib/searchResults";

export const SearchContext = createContext(null);

// Owns the search window: whether it's open, the Ctrl + K shortcut, and the window itself.
// It lives inside the workspace shell, so searches always belong to the workspace you're in.
export function SearchProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const openRef = useRef(false);

  useEffect(() => {
    openRef.current = isOpen;
  }, [isOpen]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    function onKeyDown(event) {
      // If something closer to the keys (like the editor) already used the shortcut, leave it.
      if (event.defaultPrevented || !isSearchShortcut(event)) return;

      // Keep the browser from using Ctrl + K for its own address or search bar.
      event.preventDefault();

      if (openRef.current) {
        setIsOpen(false);
        return;
      }

      // Another dialog is open: two dialogs would fight over Esc and focus, so do nothing.
      if (document.querySelector('[aria-modal="true"]')) return;
      setIsOpen(true);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);

  return (
    <SearchContext.Provider value={value}>
      {children}
      {isOpen && <SearchDialog onClose={close} />}
    </SearchContext.Provider>
  );
}