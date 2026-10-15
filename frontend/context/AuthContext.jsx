"use client";

import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { clearToken, getToken, setToken } from "@/lib/authStorage";
import { getMeRequest, loginRequest, registerRequest } from "@/services/authService";

export const AuthContext = createContext(null);

// status: "loading" (checking the stored token) | "authenticated" | "unauthenticated"
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");

  // On first load: if a token is stored, ask the backend who it belongs to.
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      if (!getToken()) return null;
      try {
        const data = await getMeRequest();
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
      setUser(null);
      setStatus("unauthenticated");
    }
    window.addEventListener("auth:logout", onForcedLogout);
    return () => window.removeEventListener("auth:logout", onForcedLogout);
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await loginRequest(credentials);
    setToken(data.token);
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const register = useCallback(async (details) => {
    const data = await registerRequest(details);
    setToken(data.token);
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setStatus("unauthenticated");
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