"use client";

import { useMemo } from "react";
import useAuth from "@/hooks/useAuth";
import useRealtime from "@/hooks/useRealtime";

const NOBODY = [];

// Who is online in a workspace, and who is editing what.
//   users:                everyone online (one entry per person, even with several tabs open)
//   others:               everyone online except you
//   isOnline(userId):     is this person online right now?
//   editorsOf(documentId): the OTHER people who have this document open in the editor
// While we're offline, or haven't joined the workspace, nothing is known and the lists are empty.
export default function usePresence(workspaceId) {
  const { presence } = useRealtime();
  const { user } = useAuth();

  const users = presence[workspaceId] ?? NOBODY;
  const myId = user?.id;

  return useMemo(() => {
    const online = new Set(users.map((person) => person.id));

    // documentId -> the people editing it
    const editors = new Map();
    for (const person of users) {
      for (const documentId of person.editing ?? []) {
        if (!editors.has(documentId)) editors.set(documentId, []);
        editors.get(documentId).push({ id: person.id, name: person.name });
      }
    }

    return {
      users,
      others: users.filter((person) => person.id !== myId),
      isOnline: (userId) => online.has(userId),
      editorsOf: (documentId) => (editors.get(documentId) ?? []).filter((person) => person.id !== myId),
    };
  }, [users, myId]);
}