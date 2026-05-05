import type { VFSEntry } from "./vfs";

export type VFSBackend = "memory" | "opfs" | "remote";

export interface VFSAdapter {
  readonly id: VFSBackend;
  readonly displayName: string;
  available(): Promise<boolean>;
  load(): Promise<VFSEntry[] | null>;
  save(entries: VFSEntry[]): Promise<void>;
}

export interface VFSAdapterStatus {
  id: VFSBackend;
  displayName: string;
  available: boolean;
  lastSync: number | null;
  lastError: string | null;
}
