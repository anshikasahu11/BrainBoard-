"use client";

import { useEffect } from "react";
import useRealtime from "@/hooks/useRealtime";

// Hear live events about a workspace while this component is on screen.
// enabled: lets the caller wait until it knows the person really is a member.
// Returns true once the server has let this tab into the room.
export default function useWorkspaceRoom(workspaceId, enabled = true) {
  const { joinWorkspace, joined } = useRealtime();

  useEffect(() => {
    if (!enabled || !workspaceId) return;
    return joinWorkspace(workspaceId);
  }, [workspaceId, enabled, joinWorkspace]);

  return joined.includes(workspaceId);
}