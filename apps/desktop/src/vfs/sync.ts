import { createSignal } from "solid-js";
import { exportSnapshot, importSnapshot, subscribeFs } from "./vfs";
import type { VFSAdapter, VFSAdapterStatus, VFSBackend } from "./adapter";
import { memoryAdapter } from "./adapters/memory";
import { opfsAdapter } from "./adapters/opfs";
import { remoteAdapter } from "./adapters/remote";

const BACKEND_KEY = "cloudos:vfs:backend";
const STATUS_KEY = "cloudos:vfs:status";

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

const [activeBackend, setActiveBackend] = createSignal<VFSBackend>(loadBackend());
const [status, setStatus] = createSignal(loadStatus());
const [busy, setBusy] = createSignal(false);

let saveTimer: ReturnType<typeof setTimeout> | null = null;

async function performSave() {
  const backend = activeBackend();
  if (backend === "memory") return;
  const adapter = adapters[backend];
  setBusy(true);
  try {
    await adapter.save(exportSnapshot());
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

export { activeBackend, status as syncStatus, busy as syncBusy };

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
