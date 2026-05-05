export interface VFSEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  mimeType: string;
  content?: string;
  children?: VFSEntry[];
  createdAt: number;
  updatedAt: number;
}

const fileSystem: Map<string, VFSEntry> = new Map();

export interface TrashEntry {
  entry: VFSEntry;
  originalPath: string;
  deletedAt: number;
}

const trash: Map<string, TrashEntry> = new Map();
const TRASH_STORAGE_KEY = "cloudos:vfs:trash";
const trashListeners = new Set<() => void>();

function notifyTrash() {
  for (const fn of trashListeners) fn();
}

export function subscribeTrash(fn: () => void): () => void {
  trashListeners.add(fn);
  return () => trashListeners.delete(fn);
}

function persistTrash() {
  if (typeof window === "undefined") return;
  try {
    const data: TrashEntry[] = Array.from(trash.values());
    window.localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function loadTrash() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(TRASH_STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as TrashEntry[];
    if (!Array.isArray(data)) return;
    for (const t of data) {
      if (t?.entry?.path) trash.set(t.entry.path, t);
    }
  } catch {
    // ignore
  }
}

function initDefaultFS() {
  const now = Date.now();

  const dirs = [
    { name: "Home", path: "/" },
    { name: "Documents", path: "/Documents" },
    { name: "Downloads", path: "/Downloads" },
    { name: "Pictures", path: "/Pictures" },
    { name: "Music", path: "/Music" },
    { name: "Videos", path: "/Videos" },
    { name: "Desktop", path: "/Desktop" },
  ];

  for (const d of dirs) {
    fileSystem.set(d.path, {
      name: d.name,
      path: d.path,
      isDir: true,
      size: 0,
      mimeType: "directory",
      createdAt: now,
      updatedAt: now,
    });
  }

  const files: { name: string; path: string; content: string; mime: string }[] = [
    {
      name: "welcome.txt",
      path: "/Documents/welcome.txt",
      content: "Welcome to CloudOS!\n\nThis is your personal cloud operating system.\nExplore the apps and features available to you.",
      mime: "text/plain",
    },
    {
      name: "notes.md",
      path: "/Documents/notes.md",
      content: "# My Notes\n\n- CloudOS is running\n- File Manager works\n- Try the terminal\n",
      mime: "text/markdown",
    },
    {
      name: "readme.txt",
      path: "/Desktop/readme.txt",
      content: "Right-click the desktop to access options.\nClick Apps in the taskbar to launch applications.",
      mime: "text/plain",
    },
  ];

  for (const f of files) {
    fileSystem.set(f.path, {
      name: f.name,
      path: f.path,
      isDir: false,
      size: f.content.length,
      mimeType: f.mime,
      content: f.content,
      createdAt: now,
      updatedAt: now,
    });
  }
}

initDefaultFS();
loadTrash();

export function listDir(path: string): VFSEntry[] {
  const entries: VFSEntry[] = [];
  const prefix = path === "/" ? "/" : path + "/";

  for (const [p, entry] of fileSystem) {
    if (p === path) continue;
    if (!p.startsWith(prefix)) continue;
    const remainder = p.slice(prefix.length);
    if (!remainder.includes("/")) {
      entries.push(entry);
    }
  }

  return entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function getEntry(path: string): VFSEntry | undefined {
  return fileSystem.get(path);
}

export function createFile(path: string, name: string, content = ""): VFSEntry {
  const fullPath = path === "/" ? `/${name}` : `${path}/${name}`;
  const now = Date.now();
  const entry: VFSEntry = {
    name,
    path: fullPath,
    isDir: false,
    size: content.length,
    mimeType: guessMimeType(name),
    content,
    createdAt: now,
    updatedAt: now,
  };
  fileSystem.set(fullPath, entry);
  return entry;
}

export function createDir(path: string, name: string): VFSEntry {
  const fullPath = path === "/" ? `/${name}` : `${path}/${name}`;
  const now = Date.now();
  const entry: VFSEntry = {
    name,
    path: fullPath,
    isDir: true,
    size: 0,
    mimeType: "directory",
    createdAt: now,
    updatedAt: now,
  };
  fileSystem.set(fullPath, entry);
  return entry;
}

export function deleteEntry(path: string) {
  fileSystem.delete(path);
  for (const key of fileSystem.keys()) {
    if (key.startsWith(path + "/")) fileSystem.delete(key);
  }
}

function uniqueTrashPath(name: string): string {
  let candidate = `/Trash/${name}`;
  let counter = 1;
  while (trash.has(candidate)) {
    const dot = name.lastIndexOf(".");
    if (dot > 0) {
      candidate = `/Trash/${name.slice(0, dot)} (${counter})${name.slice(dot)}`;
    } else {
      candidate = `/Trash/${name} (${counter})`;
    }
    counter++;
  }
  return candidate;
}

export function moveToTrash(path: string): TrashEntry | undefined {
  const entry = fileSystem.get(path);
  if (!entry) return undefined;
  const trashPath = uniqueTrashPath(entry.name);
  const snapshot: VFSEntry = { ...entry, path: trashPath };
  const record: TrashEntry = {
    entry: snapshot,
    originalPath: path,
    deletedAt: Date.now(),
  };
  trash.set(trashPath, record);
  // remove original (and descendants if dir)
  fileSystem.delete(path);
  if (entry.isDir) {
    for (const key of Array.from(fileSystem.keys())) {
      if (key.startsWith(path + "/")) fileSystem.delete(key);
    }
  }
  persistTrash();
  notifyTrash();
  return record;
}

export function listTrash(): TrashEntry[] {
  return Array.from(trash.values()).sort((a, b) => b.deletedAt - a.deletedAt);
}

export function restoreFromTrash(trashPath: string): VFSEntry | undefined {
  const record = trash.get(trashPath);
  if (!record) return undefined;
  let target = record.originalPath;
  // if a file/dir already lives at originalPath, append a suffix
  if (fileSystem.has(target)) {
    const dot = record.entry.name.lastIndexOf(".");
    const baseName = dot > 0 ? record.entry.name.slice(0, dot) : record.entry.name;
    const ext = dot > 0 ? record.entry.name.slice(dot) : "";
    let counter = 1;
    while (fileSystem.has(target)) {
      const parent = record.originalPath.slice(0, record.originalPath.lastIndexOf("/")) || "/";
      const newName = `${baseName} (restored ${counter})${ext}`;
      target = parent === "/" ? `/${newName}` : `${parent}/${newName}`;
      counter++;
    }
  }
  const restored: VFSEntry = {
    ...record.entry,
    path: target,
    name: target.split("/").pop() ?? record.entry.name,
    updatedAt: Date.now(),
  };
  fileSystem.set(target, restored);
  trash.delete(trashPath);
  persistTrash();
  notifyTrash();
  return restored;
}

export function permanentDelete(trashPath: string) {
  trash.delete(trashPath);
  persistTrash();
  notifyTrash();
}

export function emptyTrash() {
  trash.clear();
  persistTrash();
  notifyTrash();
}

export interface VFSStats {
  fileCount: number;
  dirCount: number;
  totalBytes: number;
  trashCount: number;
  trashBytes: number;
  byFolder: { path: string; bytes: number; count: number }[];
}

export function vfsStats(): VFSStats {
  let fileCount = 0;
  let dirCount = 0;
  let totalBytes = 0;
  const byFolder: Record<string, { bytes: number; count: number }> = {};
  for (const entry of fileSystem.values()) {
    if (entry.isDir) {
      dirCount++;
      continue;
    }
    fileCount++;
    totalBytes += entry.size;
    // tally top-level folder usage
    const parts = entry.path.split("/").filter(Boolean);
    const top = parts.length > 1 ? `/${parts[0]}` : "/";
    if (!byFolder[top]) byFolder[top] = { bytes: 0, count: 0 };
    byFolder[top].bytes += entry.size;
    byFolder[top].count++;
  }
  let trashBytes = 0;
  for (const t of trash.values()) {
    trashBytes += t.entry.size;
  }
  return {
    fileCount,
    dirCount,
    totalBytes,
    trashCount: trash.size,
    trashBytes,
    byFolder: Object.entries(byFolder)
      .map(([path, s]) => ({ path, bytes: s.bytes, count: s.count }))
      .sort((a, b) => b.bytes - a.bytes),
  };
}

export function renameEntry(oldPath: string, newName: string): VFSEntry | undefined {
  const entry = fileSystem.get(oldPath);
  if (!entry) return undefined;

  const parentPath = oldPath.substring(0, oldPath.lastIndexOf("/")) || "/";
  const newPath = parentPath === "/" ? `/${newName}` : `${parentPath}/${newName}`;

  fileSystem.delete(oldPath);
  entry.name = newName;
  entry.path = newPath;
  entry.updatedAt = Date.now();
  fileSystem.set(newPath, entry);
  return entry;
}

function guessMimeType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    txt: "text/plain",
    md: "text/markdown",
    js: "text/javascript",
    ts: "text/typescript",
    json: "application/json",
    html: "text/html",
    css: "text/css",
    png: "image/png",
    jpg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
  };
  return map[ext] ?? "application/octet-stream";
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
