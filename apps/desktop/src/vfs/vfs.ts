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
