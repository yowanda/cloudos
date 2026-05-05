import { createSignal } from "solid-js";
import {
  entriesChangedSince,
  exportSnapshot,
  getLatestClock,
  importSnapshot,
  markAllPathsSynced,
  mergeDelta,
  subscribeFs,
  tombstonesSince,
} from "./vfs";
import { loadConflicts, recordConflict } from "./conflicts";
import type { VFSAdapter, VFSAdapterStatus, VFSBackend } from "./adapter";
import { memoryAdapter } from "./adapters/memory";
import { opfsAdapter } from "./adapters/opfs";
import { remoteAdapter } from "./adapters/remote";

const BACKEND_KEY = "cloudos:vfs:backend";
const STATUS_KEY = "cloudos:vfs:status";
const INCREMENTAL_KEY = "cloudos:vfs:sync-incremental";
const LAST_PUSHED_CLOCK_KEY = "cloudos:vfs:last-pushed-clock";

const adapters: Record<VFSBackend, VFSAdapter> = {
  memory: memoryAdapter,
  opfs: opfsAdapter,
  remote: remoteAdapter,
};

function loadBackend(): VFSBackend {
  if (typeof window === "undefined") return "memory";
  const v = window.localStorage.getItem(BACKEND_KEY);
  if (v === "opfs" || v === "remote") return v;
  return "memory";
}

function loadStatus(): { lastSync: number | null; lastError: string | null } {
  if (typeof window === "undefined") return { lastSync: null, lastError: null };
  try {
    const raw = window.localStorage.getItem(STATUS_KEY);
    if (!raw) return { lastSync: null, lastError: null };
    const o = JSON.parse(raw) as { lastSync?: number | null; lastError?: string | null };
    return { lastSync: o.lastSync ?? null, lastError: o.lastError ?? null };
  } catch {
    return { lastSync: null, lastError: null };
  }
}

function saveStatus(s: { lastSync: number | null; lastError: string | null }) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STATUS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

// ───── Incremental sync preference (B31, stage 2b) ──────────────────
//
// `useIncremental` controls whether the remote adapter's full-snapshot
// `save` path or the lightweight `syncDelta` (POST /vfs/changes) path
// is used. Default ON — the new endpoint is what every fresh CloudOS
// server ships with, and the adapter automatically falls back to a
// full snapshot if the server returns 404 (old build). Users can flip
// this off in Settings → Backend if they prefer the legacy behaviour.

function loadIncrementalPref(): boolean {
  if (typeof window === "undefined") return true;
  const v = window.localStorage.getItem(INCREMENTAL_KEY);
  // null (never set) → default true; "0" → off; anything else → on.
  return v !== "0";
}

function loadLastPushedClock(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(LAST_PUSHED_CLOCK_KEY);
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function saveLastPushedClock(n: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_PUSHED_CLOCK_KEY, String(n));
  } catch {
    // ignore
  }
}

const [activeBackend, setActiveBackend] = createSignal<VFSBackend>(loadBackend());
const [status, setStatus] = createSignal(loadStatus());
const [busy, setBusy] = createSignal(false);
const [useIncremental, setUseIncrementalSig] = createSignal<boolean>(loadIncrementalPref());
const [lastPushedClock, setLastPushedClockSig] = createSignal<number>(loadLastPushedClock());

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Try the adapter's `syncDelta` if the user has opted in and the
 * adapter implements it. Returns true if the round-trip happened (so
 * the caller can skip the full-snapshot fallback). Any error is
 * propagated to the caller.
 */
async function tryIncrementalSync(adapter: VFSAdapter): Promise<boolean> {
  if (!useIncremental()) return false;
  if (typeof adapter.syncDelta !== "function") return false;

  const since = lastPushedClock();
  const payload = {
    since,
    entries: entriesChangedSince(since),
    tombstones: tombstonesSince(since),
  };
  // First sync after a fresh hydrate may have nothing locally pending.
  // We still hit the endpoint so we can pull any server-side changes
  // we don't yet have, but we skip if nothing on either side has
  // advanced past the watermark.
  const localClock = getLatestClock();
  if (payload.entries.length === 0 && payload.tombstones.length === 0 && localClock <= since) {
    return true;
  }

  const resp = await adapter.syncDelta(payload);
  if (!resp) return false; // adapter signalled "no support" — caller falls back

  // Apply server's inverse delta locally. mergeDelta handles LWW so we
  // never clobber a strictly-newer local write — and surfaces any
  // genuine concurrent-edit conflicts as a returned list, which we
  // forward to the conflict store for user review (stage 3).
  if (resp.entries.length > 0 || resp.tombstones.length > 0) {
    const conflictReports = mergeDelta({ entries: resp.entries, tombstones: resp.tombstones });
    if (conflictReports.length > 0) {
      const now = Date.now();
      for (const cr of conflictReports) {
        recordConflict({ ...cr, detectedAt: now });
      }
    }
  }
  // Mark every path that was just confirmed in-sync as the new fork
  // point for future merges. We use the bulk helper because everything
  // currently in the local tree is now guaranteed to also live on the
  // server (either we pushed it, or the server pushed it back at us).
  markAllPathsSynced();
  // Persist the new watermark — anything with clock <= resp.clock has
  // been observed by the server.
  setLastPushedClockSig(resp.clock);
  saveLastPushedClock(resp.clock);
  return true;
}

async function performSave() {
  const backend = activeBackend();
  if (backend === "memory") return;
  const adapter = adapters[backend];
  setBusy(true);
  try {
    let pushed = false;
    try {
      pushed = await tryIncrementalSync(adapter);
    } catch (e) {
      // Incremental failed — log and fall through to full snapshot so
      // the user's data still gets pushed.
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[vfs/sync] incremental sync failed; falling back to full snapshot: ${msg}`);
    }
    if (!pushed) {
      await adapter.save(exportSnapshot());
      // After a full snapshot, the server now has every entry up to
      // our latest clock — bring the watermark forward so the next
      // delta cycle is a true delta rather than a re-push, and mark
      // every path as synced at its current clock so subsequent merges
      // can detect concurrent edits.
      const c = getLatestClock();
      setLastPushedClockSig(c);
      saveLastPushedClock(c);
      markAllPathsSynced();
    }
    const s = { lastSync: Date.now(), lastError: null };
    setStatus(s);
    saveStatus(s);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const s = { lastSync: status().lastSync, lastError: msg };
    setStatus(s);
    saveStatus(s);
  } finally {
    setBusy(false);
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void performSave();
  }, 800);
}

let initialized = false;
let unsubFs: (() => void) | null = null;

function attachFsListener() {
  if (unsubFs) {
    unsubFs();
    unsubFs = null;
  }
  if (activeBackend() !== "memory") {
    unsubFs = subscribeFs(scheduleSave);
  }
}

export async function initVfsSync(): Promise<void> {
  if (initialized) return;
  initialized = true;
  // Load any conflict records persisted from a previous session so the
  // tray badge / Settings panel show them right after boot.
  loadConflicts();
  // Try to hydrate from active backend on boot
  const backend = activeBackend();
  if (backend !== "memory") {
    try {
      const adapter = adapters[backend];
      const ok = await adapter.available();
      if (ok) {
        const entries = await adapter.load();
        if (entries && entries.length > 0) {
          importSnapshot(entries);
          // After a fresh full hydrate, the watermark is whatever the
          // largest incoming clock was — pre-load that into the
          // last-pushed-clock so the next delta sync only pushes
          // changes that have happened since, and mark every path as
          // synced for conflict detection.
          const c = getLatestClock();
          setLastPushedClockSig(c);
          saveLastPushedClock(c);
          markAllPathsSynced();
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const s = { lastSync: status().lastSync, lastError: msg };
      setStatus(s);
      saveStatus(s);
    }
  }
  attachFsListener();
}

export async function setBackend(next: VFSBackend): Promise<void> {
  if (next === activeBackend()) return;
  setBusy(true);
  try {
    const adapter = adapters[next];
    if (next !== "memory") {
      const ok = await adapter.available();
      if (!ok) throw new Error(`${adapter.displayName} is not available`);
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(BACKEND_KEY, next);
    }
    setActiveBackend(next);
    // Switching backends invalidates the watermark — the new backend
    // doesn't know what we've already pushed there.
    setLastPushedClockSig(0);
    saveLastPushedClock(0);
    attachFsListener();
    if (next !== "memory") {
      // Push current snapshot to the new backend
      await performSave();
    } else {
      const s = { lastSync: status().lastSync, lastError: null };
      setStatus(s);
      saveStatus(s);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const s = { lastSync: status().lastSync, lastError: msg };
    setStatus(s);
    saveStatus(s);
    throw e;
  } finally {
    setBusy(false);
  }
}

export async function syncNow(): Promise<void> {
  await performSave();
}

export async function pullFromBackend(): Promise<void> {
  const backend = activeBackend();
  if (backend === "memory") return;
  setBusy(true);
  try {
    const adapter = adapters[backend];
    const entries = await adapter.load();
    if (entries) {
      importSnapshot(entries);
      const c = getLatestClock();
      setLastPushedClockSig(c);
      saveLastPushedClock(c);
      markAllPathsSynced();
      const s = { lastSync: Date.now(), lastError: null };
      setStatus(s);
      saveStatus(s);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const s = { lastSync: status().lastSync, lastError: msg };
    setStatus(s);
    saveStatus(s);
  } finally {
    setBusy(false);
  }
}

/** Reactive accessor for the user's incremental-sync preference. */
export const incrementalEnabled = useIncremental;

/** Toggle the incremental-sync preference and persist. */
export function setIncrementalEnabled(next: boolean): void {
  setUseIncrementalSig(next);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INCREMENTAL_KEY, next ? "1" : "0");
  } catch {
    // ignore
  }
}

/** Reactive accessor for the last clock the server confirmed receipt of. */
export const lastPushedClockSig = lastPushedClock;

export async function adapterStatuses(): Promise<VFSAdapterStatus[]> {
  const out: VFSAdapterStatus[] = [];
  for (const id of ["memory", "opfs", "remote"] as VFSBackend[]) {
    const adapter = adapters[id];
    const ok = await adapter.available().catch(() => false);
    out.push({
      id,
      displayName: adapter.displayName,
      available: ok,
      lastSync: status().lastSync,
      lastError: status().lastError,
    });
  }
  return out;
}

export { activeBackend, status as syncStatus, busy as syncBusy };
