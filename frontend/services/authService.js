import { apiFetch } from "@/lib/api";

export const registerRequest = (data) =>
  apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify(data) });

export const loginRequest = (data) =>
  apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify(data) });

export const getMeRequest = () => apiFetch("/api/auth/me");