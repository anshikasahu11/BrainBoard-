"use client";

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearToken, getToken, setToken } from "@/lib/authStorage";
import { endSessionRequest } from "@/lib/endSession";
import { getMeRequest, loginRequest, registerRequest } from "@/services/authService";

export const AuthContext = createContext(null);

// status: "loading" (checking the stored token) | "authenticated" | "unauthenticated"
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");

  // The token THIS tab signed in with. Another tab changing the stored token is noticed by
  // comparing it to this.
  const sessionToken = useRef(null);

  // On first load: if a token is stored, ask the backend who it belongs to.
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const token = getToken();
      if (!token) return null;

      try {
        const data = await getMeRequest();
        sessionToken.current = token;
        return data.user;
      } catch (error) {
        // Only a real 401 means the token is bad. If the server is just
        // unreachable, keep the token so the next load can try again.
        if (error.status === 401) clearToken();
        return null;
      }
    }

    restoreSession().then((restoredUser) => {
      if (cancelled) return;
      setUser(restoredUser);
      setStatus(restoredUser ? "authenticated" : "unauthenticated");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // apiFetch fires this event when the server rejects the token mid-session.
  useEffect(() => {
    function onForcedLogout() {
      sessionToken.current = null;
      setUser(null);
      setStatus("unauthenticated");
    }
    window.addEventListener("auth:logout", onForcedLogout);
    return () => window.removeEventListener("auth:logout", onForcedLogout);
  }, []);

  // Another tab of this browser signed out, or signed in as someone else. (This event only fires
  // in OTHER tabs, so it never reacts to this tab's own changes.)
  useEffect(() => {
    function onStorage() {
      if (!sessionToken.current) return;

      const current = getToken();
      if (!current) {
        // Signed out in another tab: this one follows.
        sessionToken.current = null;
        setUser(null);
        setStatus("unauthenticated");
      } else if (current !== sessionToken.current) {
        // Signed in as someone else in another tab. Reload, so this tab shows (and acts as) the
        // same person, instead of showing one name while sending another's token.
        window.location.reload();
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await loginRequest(credentials);
    setToken(data.token);
    sessionToken.current = data.token;
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const register = useCallback(async (details) => {
    const data = await registerRequest(details);
    setToken(data.token);
    sessionToken.current = data.token;
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  // Signing out is instant on screen. The server is told in the background, using the token we
  // grabbed first, so a copy of it stops working. If that can't be sent (offline), the browser has
  // still forgotten it, and it expires on its own.
  const logout = useCallback(() => {
    const token = getToken();

    clearToken();
    sessionToken.current = null;
    setUser(null);
    setStatus("unauthenticated");

    if (token) endSessionRequest(token);
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === "authenticated",
      login,
      register,
      logout,
    }),
    [user, status, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}