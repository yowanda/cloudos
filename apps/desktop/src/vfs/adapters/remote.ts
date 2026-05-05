import type { VFSAdapter, VFSDeltaPayload, VFSDeltaResponse } from "../adapter";
import type { VFSEntry } from "../vfs";

const CONFIG_KEY = "cloudos:vfs:remote-config";

export interface RemoteConfig {
  baseUrl: string;
  token: string;
}

const defaultConfig: RemoteConfig = {
  baseUrl: "/api/v1",
  token: "",
};

export function loadRemoteConfig(): RemoteConfig {
  if (typeof window === "undefined") return { ...defaultConfig };
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...defaultConfig };
    const partial = JSON.parse(raw) as Partial<RemoteConfig>;
    return { ...defaultConfig, ...partial };
  } catch {
    return { ...defaultConfig };
  }
}

export function saveRemoteConfig(c: RemoteConfig) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
  } catch {
    // ignore
  }
}

function headers(c: RemoteConfig): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (c.token) h.authorization = `Bearer ${c.token}`;
  return h;
}

export const remoteAdapter: VFSAdapter = {
  id: "remote",
  displayName: "Remote API (HTTP)",

  async available() {
    const cfg = loadRemoteConfig();
    if (!cfg.baseUrl) return false;
    try {
      const url = `${cfg.baseUrl.replace(/\/$/, "")}/vfs/health`;
      const res = await fetch(url, { method: "GET", headers: headers(cfg) });
      return res.ok;
    } catch {
      return false;
    }
  },

  async load() {
    const cfg = loadRemoteConfig();
    const url = `${cfg.baseUrl.replace(/\/$/, "")}/vfs/snapshot`;
    const res = await fetch(url, { method: "GET", headers: headers(cfg) });
    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Remote VFS load failed: HTTP ${res.status} ${text || res.statusText}`);
    }
    const data = (await res.json()) as { entries?: VFSEntry[] };
    return Array.isArray(data.entries) ? data.entries : null;
  },

  async save(entries: VFSEntry[]) {
    const cfg = loadRemoteConfig();
    const url = `${cfg.baseUrl.replace(/\/$/, "")}/vfs/snapshot`;
    const res = await fetch(url, {
      method: "PUT",
      headers: headers(cfg),
      body: JSON.stringify({ entries }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Remote VFS save failed: HTTP ${res.status} ${text || res.statusText}`);
    }
  },

  async syncDelta(payload: VFSDeltaPayload): Promise<VFSDeltaResponse | null> {
    const cfg = loadRemoteConfig();
    const url = `${cfg.baseUrl.replace(/\/$/, "")}/vfs/changes`;
    const res = await fetch(url, {
      method: "POST",
      headers: headers(cfg),
      body: JSON.stringify({
        since: payload.since,
        entries: payload.entries,
        tombstones: payload.tombstones,
      }),
    });
    // 404 = old server without the /changes endpoint. Surface as `null`
    // so sync.ts knows to fall back to the full-snapshot `save` path.
    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Remote VFS delta sync failed: HTTP ${res.status} ${text || res.statusText}`);
    }
    const data = (await res.json()) as Partial<VFSDeltaResponse>;
    return {
      clock: typeof data.clock === "number" ? data.clock : payload.since,
      entries: Array.isArray(data.entries) ? data.entries : [],
      tombstones: Array.isArray(data.tombstones) ? data.tombstones : [],
    };
  },
};
