import type { VFSAdapter } from "../adapter";
import type { VFSEntry } from "../vfs";

const SNAPSHOT_NAME = "cloudos-vfs.json";

async function getRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof navigator === "undefined") return null;
  const sa = navigator.storage as { getDirectory?: () => Promise<FileSystemDirectoryHandle> };
  if (typeof sa?.getDirectory !== "function") return null;
  try {
    return await sa.getDirectory();
  } catch {
    return null;
  }
}

export const opfsAdapter: VFSAdapter = {
  id: "opfs",
  displayName: "Origin Private File System (browser-native)",

  async available() {
    const root = await getRoot();
    return !!root;
  },

  async load() {
    const root = await getRoot();
    if (!root) return null;
    try {
      const fileHandle = await root.getFileHandle(SNAPSHOT_NAME, { create: false });
      const file = await fileHandle.getFile();
      const text = await file.text();
      const arr = JSON.parse(text) as VFSEntry[];
      return Array.isArray(arr) ? arr : null;
    } catch (e) {
      const err = e as { name?: string };
      if (err?.name === "NotFoundError") return null;
      throw e;
    }
  },

  async save(entries: VFSEntry[]) {
    const root = await getRoot();
    if (!root) throw new Error("OPFS not available");
    const fileHandle = await root.getFileHandle(SNAPSHOT_NAME, { create: true });
    const handle = fileHandle as FileSystemFileHandle & {
      createWritable?: () => Promise<FileSystemWritableFileStream>;
    };
    if (!handle.createWritable) throw new Error("OPFS createWritable unavailable");
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(entries));
    await writable.close();
  },
};
