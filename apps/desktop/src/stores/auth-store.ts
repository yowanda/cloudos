import { createSignal } from "solid-js";
import { playSound } from "../core/sound-manager";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  avatar_url?: string;
}

const [isAuthenticated, setIsAuthenticated] = createSignal(false);
const [user, setUser] = createSignal<AuthUser | null>(null);
const [token, setToken] = createSignal<string | null>(null);
const [isLocked, setIsLocked] = createSignal(true);
const [authLoading, setAuthLoading] = createSignal(false);
const [authError, setAuthError] = createSignal("");

const API_BASE = import.meta.env.VITE_API_URL ?? "/api/v1";

export {
  isAuthenticated,
  user,
  token,
  isLocked,
  authLoading,
  authError,
  setIsLocked,
};

export async function login(email: string, password: string) {
  setAuthLoading(true);
  setAuthError("");

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Login failed");

    setToken(data.token);
    setUser(data.user);
    setIsAuthenticated(true);
    setIsLocked(false);
    playSound("unlock");
    localStorage.setItem("cloudos_token", data.token);
  } catch (e: any) {
    setAuthError(e.message);
  } finally {
    setAuthLoading(false);
  }
}

export async function register(email: string, username: string, password: string) {
  setAuthLoading(true);
  setAuthError("");

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Registration failed");

    setToken(data.token);
    setUser(data.user);
    setIsAuthenticated(true);
    setIsLocked(false);
    playSound("unlock");
    localStorage.setItem("cloudos_token", data.token);
  } catch (e: any) {
    setAuthError(e.message);
  } finally {
    setAuthLoading(false);
  }
}

export async function restoreSession() {
  const savedToken = localStorage.getItem("cloudos_token");
  if (!savedToken) {
    setIsLocked(true);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${savedToken}` },
    });

    if (!res.ok) throw new Error("Session expired");

    const data = await res.json();
    setToken(savedToken);
    setUser(data);
    setIsAuthenticated(true);
    setIsLocked(false);
    playSound("unlock");
  } catch {
    localStorage.removeItem("cloudos_token");
    setIsLocked(true);
  }
}

export function logout() {
  setToken(null);
  setUser(null);
  setIsAuthenticated(false);
  setIsLocked(true);
  localStorage.removeItem("cloudos_token");
}

export function lockScreen() {
  setIsLocked(true);
  playSound("lock");
}
