"use client";

import { useMemo } from "react";
import useAuth from "@/hooks/useAuth";
import useRealtime from "@/hooks/useRealtime";

const NONE = [];

// Who's online in a workspace right now, from the live presence the server sends.
//   users:     everyone online, you included: [{ id, name, editing: [documentId, ...] }]
//   others:    the same without you
//   onlineIds: a Set of their ids, for "is this person online?"
export default function usePresence(workspaceId) {
  const { presence } = useRealtime();
  const { user } = useAuth();

  const users = presence[workspaceId] ?? NONE;

  return useMemo(
    () => ({
      users,
      others: users.filter((person) => person.id !== user?.id),
      onlineIds: new Set(users.map((person) => person.id)),
    }),
    [users, user?.id]
  );
}