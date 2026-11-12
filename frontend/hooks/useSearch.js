"use client";

import { useContext } from "react";
import { SearchContext } from "@/context/SearchContext";

// Usage: const { open, close, isOpen } = useSearch();
export default function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearch must be used inside <SearchProvider>");
  }
  return context;
}