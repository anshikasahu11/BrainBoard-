"use client";

import { useContext } from "react";
import { RealtimeContext } from "@/context/RealtimeContext";

// Usage: const { status, joined, subscribe, joinWorkspace } = useRealtime();
export default function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtime must be used inside <RealtimeProvider>");
  }
  return context;
}