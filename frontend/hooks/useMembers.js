"use client";

import { useEffect, useState } from "react";
import { listMembersRequest } from "@/services/memberService";

// Loads the workspace's people (for assignee choices).
// Returns { status: "loading" | "ready" | "error", members }.
export default function useMembers(workspaceId) {
  const [state, setState] = useState({ status: "loading", members: [] });

  useEffect(() => {
    let cancelled = false;

    listMembersRequest(workspaceId)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", members: data.members });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", members: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return state;
}