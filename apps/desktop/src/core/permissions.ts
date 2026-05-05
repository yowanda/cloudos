import { createSignal } from "solid-js";
import type { AppPermission } from "./app-manifest";
import { getManifest } from "./app-manifest";

/**
 * Runtime permission gate for sandboxed manifest apps.
 *
 * Two-stage model:
 *   1. The manifest declares which permissions the app *can* use.
 *      This is enforced at install time; an app can never request a
 *      permission it didn't declare.
 *   2. The user explicitly grants (or denies) each declared permission
 *      the first time the app actually exercises it. Grants are
 *      persisted in localStorage and can be revoked from Settings.
 *
 * Built-in (non-manifest) apps don't go through the bridge, so they
 * don't go through this gate either — they're treated as trusted.
 */

export type PermissionDecision = "ask" | "granted" | "denied";

interface PendingPrompt {
  appId: string;
  perm: AppPermission;
  resolve: (decision: "granted" | "denied") => void;
}

const STORAGE_KEY = "cloudos:permissions:v1";

// Persisted decisions, keyed by `${appId}::${perm}`.
const decisions = new Map<string, PermissionDecision>();
const [decisionsVersion, bumpDecisions] = createSignal(0);

// Currently-visible prompt (only one at a time; subsequent prompts queue
// behind it via `pending`).
const [activePrompt, setActivePrompt] = createSignal<PendingPrompt | null>(null);
const pending: PendingPrompt[] = [];

function key(appId: string, perm: AppPermission): string {
  return `${appId}::${perm}`;
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, PermissionDecision> = {};
    for (const [k, v] of decisions) obj[k] = v;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // ignore
  }
}

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, PermissionDecision>;
    for (const [k, v] of Object.entries(obj)) {
      if (v === "granted" || v === "denied" || v === "ask") {
        decisions.set(k, v);
      }
    }
  } catch {
    // ignore
  }
}
load();

/**
 * Reactive accessor: changes whenever any permission decision is updated.
 * Components reading via `getPermissionState` should also depend on this
 * signal if they want live updates.
 */
export const permissionsVersion = decisionsVersion;

export function getPermissionState(appId: string, perm: AppPermission): PermissionDecision {
  return decisions.get(key(appId, perm)) ?? "ask";
}

export function setPermissionState(appId: string, perm: AppPermission, state: PermissionDecision) {
  if (state === "ask") {
    decisions.delete(key(appId, perm));
  } else {
    decisions.set(key(appId, perm), state);
  }
  persist();
  bumpDecisions((v) => v + 1);
}

/**
 * Forget every grant/deny for an app. Used when an app is uninstalled.
 */
export function clearAppPermissions(appId: string) {
  let touched = false;
  for (const k of Array.from(decisions.keys())) {
    if (k.startsWith(`${appId}::`)) {
      decisions.delete(k);
      touched = true;
    }
  }
  if (touched) {
    persist();
    bumpDecisions((v) => v + 1);
  }
}

/**
 * List every (perm → decision) for one app. Useful for the Settings
 * Permissions UI. Includes manifest-declared perms even when their
 * decision is still "ask" (so the UI can show them as pending).
 */
export function listAppPermissions(appId: string): { perm: AppPermission; state: PermissionDecision }[] {
  const m = getManifest(appId);
  const declared = m?.permissions ?? [];
  return declared.map((p) => ({ perm: p, state: getPermissionState(appId, p) }));
}

/**
 * Async permission gate. Returns true if the app may use the permission.
 *
 *   - returns false immediately if the manifest doesn't declare it;
 *   - returns true immediately if the user has already granted it;
 *   - returns false immediately if the user has already denied it;
 *   - otherwise shows a prompt and resolves with the user's choice.
 */
export async function requestPermission(appId: string, perm: AppPermission): Promise<boolean> {
  const m = getManifest(appId);
  if (!m) return false;
  if (!m.permissions.includes(perm)) return false;

  const cur = getPermissionState(appId, perm);
  if (cur === "granted") return true;
  if (cur === "denied") return false;

  return await prompt(appId, perm);
}

function prompt(appId: string, perm: AppPermission): Promise<boolean> {
  return new Promise((resolve) => {
    const item: PendingPrompt = {
      appId,
      perm,
      resolve: (decision) => {
        setPermissionState(appId, perm, decision);
        resolve(decision === "granted");
        // Promote next queued prompt, if any.
        const next = pending.shift();
        setActivePrompt(next ?? null);
      },
    };
    if (activePrompt() === null) setActivePrompt(item);
    else pending.push(item);
  });
}

export const activePermissionPrompt = activePrompt;

/**
 * Human-readable description for a permission. Used in the prompt UI
 * and the Settings list.
 */
export function permissionLabel(perm: AppPermission): string {
  switch (perm) {
    case "notifications": return "Show notifications";
    case "files.read":    return "Read your files";
    case "files.write":   return "Write to your files";
    case "windows":       return "Control its own window (close, minimize, maximize, focus, list)";
    case "clipboard.read":  return "Read from the system clipboard";
    case "clipboard.write": return "Write to the system clipboard";
  }
}
