"use client";

import useLoad from "@/hooks/useLoad";
import { getAiStatusRequest } from "@/services/aiService";

// Asks the server whether AI is available for this workspace, and what's left today.
// Returns { status: "loading" | "ready" | "error", data, error, reload, retry }.
// Asking costs nothing: no text is sent and no allowance is used.
export default function useAiStatus(workspaceId) {
  return useLoad(`ai-status:${workspaceId}`, () => getAiStatusRequest(workspaceId));
}