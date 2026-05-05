import type { VFSEntry, VFSTombstone } from "./vfs";

export type VFSBackend = "memory" | "opfs" | "remote";

export interface VFSDeltaPayload {
  /** Watermark — the highest clock the client already has from the server. */
  since: number;
  /** Entries created / modified locally since `since`. */
  entries: VFSEntry[];
  /** Paths the client deleted locally since `since`. */
  tombstones: VFSTombstone[];
}

export interface VFSDeltaResponse {
  /** New server-side watermark — the client should persist this for next time. */
  clock: number;
  /** Entries the server has whose clock > `since` and that the client didn't send. */
  entries: VFSEntry[];
  /** Tombstones the server has whose clock > `since` and that the client didn't send. */
  tombstones: VFSTombstone[];
}

export interface VFSAdapter {
  readonly id: VFSBackend;
  readonly displayName: string;
  available(): Promise<boolean>;
  load(): Promise<VFSEntry[] | null>;
  save(entries: VFSEntry[]): Promise<void>;
  /**
   * Optional incremental diff-sync round-trip. When implemented and the
   * caller (`vfs/sync.ts`) detects the backend supports it, the full-
   * snapshot `save` path is bypassed in favour of this lightweight
   * delta exchange. Return `null` to signal the backend doesn't yet
   * support the protocol so the caller falls back to `save`.
   */
  syncDelta?(payload: VFSDeltaPayload): Promise<VFSDeltaResponse | null>;
}

export interface VFSAdapterStatus {
  id: VFSBackend;
  displayName: string;
  available: boolean;
  lastSync: number | null;
  lastError: string | null;
}
