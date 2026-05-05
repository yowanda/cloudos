import { createSignal } from "solid-js";

export type AppPermission =
  | "notifications"
  | "files.read"
  | "files.write"
  | "windows"
  | "clipboard.read"
  | "clipboard.write";

export type AppEntry =
  | { type: "builtin" }
  | { type: "iframe"; html: string }
  | { type: "iframe-url"; url: string };

export interface AppManifest {
  id: string;
  name: string;
  version: string;
  icon: string;
  description?: string;
  author?: string;
  category?: string;
  permissions: AppPermission[];
  entry: AppEntry;
  window?: {
    width?: number;
    height?: number;
    resizable?: boolean;
    minWidth?: number;
    minHeight?: number;
  };
}

const STORAGE_KEY = "cloudos:manifests:installed";

const builtinManifests = new Map<string, AppManifest>();
const installedManifests = new Map<string, AppManifest>();
const [version, setVersion] = createSignal(0);

function persist() {
  if (typeof window === "undefined") return;
  try {
    const list = Array.from(installedManifests.values()).filter(
      (m) => !builtinManifests.has(m.id),
    );
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function loadInstalled() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw) as AppManifest[];
    if (Array.isArray(arr)) {
      for (const m of arr) installedManifests.set(m.id, m);
    }
  } catch {
    // ignore
  }
}

loadInstalled();

export const manifestsVersion = version;

export function registerBuiltinManifest(m: AppManifest) {
  builtinManifests.set(m.id, m);
  installedManifests.set(m.id, m);
  setVersion((v) => v + 1);
}

export function installManifest(m: AppManifest) {
  installedManifests.set(m.id, m);
  persist();
  setVersion((v) => v + 1);
}

export function uninstallManifest(id: string): boolean {
  if (builtinManifests.has(id)) return false;
  const ok = installedManifests.delete(id);
  if (ok) {
    persist();
    setVersion((v) => v + 1);
  }
  return ok;
}

export function listManifests(): AppManifest[] {
  return Array.from(installedManifests.values());
}

export function getManifest(id: string): AppManifest | undefined {
  return installedManifests.get(id);
}

export function isBuiltinApp(id: string): boolean {
  return builtinManifests.has(id);
}

export function hasPermission(id: string, perm: AppPermission): boolean {
  const m = getManifest(id);
  return !!m && m.permissions.includes(perm);
}
