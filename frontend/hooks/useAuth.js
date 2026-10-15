"use client";

import { useContext } from "react";
import { AuthContext } from "@/context/AuthContext";

// Usage: const { user, status, login, register, logout } = useAuth();
export default function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}