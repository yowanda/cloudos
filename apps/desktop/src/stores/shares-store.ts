import { createSignal } from "solid-js";

export type SharePermission = "read" | "comment" | "write";

export interface Share {
  id: string;
  filePath: string;
  fileName: string;
  token: string;
  permission: SharePermission;
  /** Optional expiry timestamp (ms epoch). null = never expires. */
  expiresAt: number | null;
  /** Optional password hash (sha256 hex). null = no password. */
  passwordHash: string | null;
  createdAt: number;
}

const STORAGE_KEY = "cloudos:shares";

function load(): Share[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Share[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function persist(list: Share[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

const [shares, setShares] = createSignal<Share[]>(load());

export { shares };

export function sharesFor(filePath: string): Share[] {
  return shares()
    .filter((s) => s.filePath === filePath)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function randomToken(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface CreateShareInput {
  filePath: string;
  fileName: string;
  permission: SharePermission;
  /** Days until expiry. 0/undefined = never. */
  expiresInDays?: number;
  password?: string;
}

export async function createShare(input: CreateShareInput): Promise<Share> {
  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? Date.now() + input.expiresInDays * 86400_000
      : null;
  const passwordHash = input.password ? await sha256Hex(input.password) : null;
  const share: Share = {
    id: `share-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    filePath: input.filePath,
    fileName: input.fileName,
    token: randomToken(),
    permission: input.permission,
    expiresAt,
    passwordHash,
    createdAt: Date.now(),
  };
  const next = [share, ...shares()];
  setShares(next);
  persist(next);
  return share;
}

export function revokeShare(id: string) {
  const next = shares().filter((s) => s.id !== id);
  setShares(next);
  persist(next);
}

export function findShareByToken(token: string): Share | undefined {
  return shares().find((s) => s.token === token);
}

export async function verifySharePassword(token: string, password: string): Promise<boolean> {
  const s = findShareByToken(token);
  if (!s) return false;
  if (!s.passwordHash) return true;
  const hash = await sha256Hex(password);
  return hash === s.passwordHash;
}

export function shareUrl(token: string): string {
  if (typeof window === "undefined") return `?share=${token}`;
  const url = new URL(window.location.href);
  url.searchParams.set("share", token);
  // Drop other params to keep link clean
  for (const k of Array.from(url.searchParams.keys())) {
    if (k !== "share") url.searchParams.delete(k);
  }
  return url.toString();
}

export function isExpired(s: Share): boolean {
  return !!s.expiresAt && s.expiresAt < Date.now();
}
