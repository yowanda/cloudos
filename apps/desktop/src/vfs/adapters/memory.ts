import type { VFSAdapter } from "../adapter";

/** No-op adapter — VFS already lives in-memory; nothing extra is persisted. */
export const memoryAdapter: VFSAdapter = {
  id: "memory",
  displayName: "In-memory (default)",
  async available() {
    return true;
  },
  async load() {
    return null;
  },
  async save() {
    // no-op
  },
};
