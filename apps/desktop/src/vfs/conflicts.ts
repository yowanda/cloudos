import { createSignal } from "solid-js";
import type { VFSEntry } from "./vfs";

/**
 * Stage 3 of the per-entry diff-sync feature — concurrent-edit
 * conflict detection + user-driven resolution.
 *
 * A conflict is recorded by `vfs.ts/mergeDelta` whenever both the
 * local and the incoming entry have advanced past the path's last
 * synced clock. Stage 2b's last-write-wins still applies (the higher
 * clock always becomes the live version), but the loser is preserved
 * here so the user can review and optionally restore it.
 */
export interface VFSConflict {
  path: string;
  /** The version that's currently live in the VFS after the merge. */
  winner: VFSEntry;
  /** The version that was overwritten by the merge. */
  loser: VFSEntry;
  /** Was the local version the loser? Lets the UI label which side is which. */
  loserIsLocal: boolean;
  /** Path's clock the last time the client + server were known in sync. */
  syncedClock: number;
  /** When the conflict was first observed (ms since epoch). */
  detectedAt: number;
}

const CONFLICT_KEY = "cloudos:vfs:conflicts";

const conflicts: Map<string, VFSConflict> = new Map();
const [conflictsSig, setConflictsSig] = createSignal<VFSConflict[]>([]);

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CONFLICT_KEY,
      JSON.stringify(Array.from(conflicts.values())),
    );
  } catch {
    // ignore — quota / private mode
  }
}

function refreshSignal() {
  setConflictsSig(Array.from(conflicts.values()).sort((a, b) => b.detectedAt - a.detectedAt));
}

export function loadConflicts(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(CONFLICT_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as VFSConflict[];
    if (!Array.isArray(data)) return;
    for (const c of data) {
      if (c?.path && c.winner && c.loser) {
        conflicts.set(c.path, c);
      }
    }
    refreshSignal();
  } catch {
    // ignore corrupt data
  }
}

/** Add or update a conflict record for `path`. */
export function recordConflict(c: VFSConflict): void {
  conflicts.set(c.path, c);
  persist();
  refreshSignal();
}

/** Clear the conflict on `path` without changing the live VFS. */
export function dismissConflict(path: string): VFSConflict | undefined {
  const existing = conflicts.get(path);
  if (!existing) return undefined;
  conflicts.delete(path);
  persist();
  refreshSignal();
  return existing;
}

/** Read-only signal — UI subscribers re-render when conflicts change. */
export const conflictList = conflictsSig;

/** Imperative read for non-reactive callers (slash commands, exports). */
export function listConflicts(): VFSConflict[] {
  return Array.from(conflicts.values()).sort((a, b) => b.detectedAt - a.detectedAt);
}

/** Has at least one pending conflict? Used by the tray badge. */
export const hasConflicts = () => conflictsSig().length > 0;

/** Reactive count of pending conflicts. */
export const conflictCount = () => conflictsSig().length;

/**
 * Resolve a conflict by promoting the chosen side to the live VFS.
 * - `keep: "winner"` is a no-op on the file content (LWW already won)
 *   and just dismisses the record.
 * - `keep: "loser"` writes the loser's content back into the live entry
 *   with a fresh clock so it propagates to the server on the next sync.
 *
 * Returns the dismissed conflict, or undefined if `path` had none.
 */
export async function resolveConflict(
  path: string,
  keep: "winner" | "loser",
): Promise<VFSConflict | undefined> {
  const c = conflicts.get(path);
  if (!c) return undefined;
  if (keep === "loser" && c.loser.path && !c.loser.isDir) {
    // Lazily import vfs.ts here to avoid a circular import at module
    // top-level (vfs.ts → conflicts.ts via mergeDelta types).
    const { writeFile } = await import("./vfs");
    // writeFile is upsert — creates the file (and any missing ancestor
    // directories) if it doesn't exist, otherwise overwrites. It also
    // bumps the clock past the current max so the next sync round-trip
    // pushes the restored version to the server. Works whether the
    // winner was the remote entry (replace it) or a remote tombstone
    // (resurrect the path).
    writeFile(c.loser.path, c.loser.content ?? "");
  }
  conflicts.delete(path);
  persist();
  refreshSignal();
  return c;
}

/** Clear every pending conflict — useful when the user wants a clean slate. */
export function clearAllConflicts(): VFSConflict[] {
  const all = Array.from(conflicts.values());
  conflicts.clear();
  persist();
  refreshSignal();
  return all;
}
