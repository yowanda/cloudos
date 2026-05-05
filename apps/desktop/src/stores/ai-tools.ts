/**
 * AI Assistant — context-aware **rule-based** tool layer.
 *
 * The Assistant chat (`AIAssistant.tsx` → `ai-store.sendMessage`) supports
 * five backends: `echo` (offline mock), OpenAI, OpenAI-compatible, Ollama,
 * Anthropic. Three of those need network + a paid key; one runs locally;
 * `echo` answers in canned strings.
 *
 * This module gives the Assistant **real powers without an LLM**: when a
 * user message starts with a recognised slash command (e.g. `/read`,
 * `/ls`, `/find`), we intercept it, perform the corresponding read-only
 * VFS / desktop-state lookup, and return the result as the assistant's
 * reply — bypassing whichever provider is configured. This works in
 * every mode (including `echo`) and never spends an API token.
 *
 * Slash commands are deliberately read-only or low-stakes: peeking at
 * file contents, listing directories, querying storage, dumping the
 * active window. We do NOT expose write / delete tools here — those
 * stay behind explicit user actions in their respective apps. Future
 * stages (LLM tool-calling) can graduate to richer write tools.
 *
 * Each command is documented inline; `/help` lists them all.
 */

import {
  createDir,
  deleteEntry,
  exportSnapshot,
  formatSize,
  getAllTombstones,
  getEntry,
  getLatestClock,
  listDir,
  moveEntry,
  moveToTrash,
  renameEntry,
  vfsStats,
  writeFile,
} from "../vfs/vfs";
import { listConflicts } from "../vfs/conflicts";
import { listManifests } from "../core/app-manifest";
import { profile } from "./profile-store";
import { recentApps } from "./recents-store";
import { currentDesktopWindows, focusedWindow } from "./window-store";
import { currentDesktop, desktops } from "./desktop-store";

/**
 * Describes a pending mutation requested by a dangerous slash command
 * (`/write`, `/mkdir`, `/rm`, `/mv`). The payload is computed by the
 * command's `run()` against the current VFS state — no mutation has
 * happened yet. Confirming via `executeConfirmedAction(payload)` is
 * what actually changes the VFS.
 */
export type ConfirmationPayload =
  | {
      kind: "write";
      path: string;
      content: string;
      /** Size of the existing file at `path`, or null if it doesn't exist yet. */
      existingSize: number | null;
    }
  | { kind: "mkdir"; path: string; parentPath: string; name: string }
  | {
      kind: "rm";
      path: string;
      hard: boolean;
      isDir: boolean;
      /** Number of descendant entries under a directory target (0 for files). */
      descendantCount: number;
    }
  | {
      kind: "mv";
      srcPath: string;
      finalPath: string;
      mode: "rename" | "move" | "move+rename";
    };

export interface ToolResult {
  /** True if the input was handled as a slash command (LLM should be skipped). */
  handled: boolean;
  /** The reply to surface. Multi-line text. Empty when handled=false. */
  reply: string;
  /**
   * Set when the command needs the user to confirm a mutation before it
   * runs. The chat UI should render Run / Cancel buttons and call
   * `executeConfirmedAction(payload)` only on Run.
   */
  confirmation?: ConfirmationPayload;
}

interface CommandHandler {
  /** Short human description for `/help`. */
  description: string;
  /** Sample usage shown in `/help`. */
  usage: string;
  /**
   * The actual handler. Receives the raw arg string after the command
   * name. May return either a plain text reply (read-only commands) or
   * a `ConfirmationPayload` describing a queued mutation (dangerous
   * commands). Returning a string from a dangerous command means the
   * command short-circuited with a validation error and no payload.
   */
  run: (args: string) => string | ConfirmationPayload | Promise<string | ConfirmationPayload>;
  /** Mutating commands gated by the Run / Cancel confirmation flow. */
  dangerous?: boolean;
}

const commands: Record<string, CommandHandler> = {
  help: {
    description: "List every slash command the Assistant understands.",
    usage: "/help",
    run: () => helpText(),
  },

  read: {
    description: "Print the contents of a VFS file.",
    usage: "/read <absolute-path>",
    run: (args) => {
      const path = args.trim();
      if (!path) return "Usage: `/read <absolute-path>`";
      const entry = getEntry(absPath(path));
      if (!entry) return `No such entry: \`${path}\``;
      if (entry.isDir) return `\`${entry.path}\` is a directory — try \`/ls ${entry.path}\` instead.`;
      const body = entry.content ?? "";
      // Truncate very long files so the chat doesn't get unusable.
      const MAX = 4000;
      const truncated = body.length > MAX ? body.slice(0, MAX) + `\n…\n[truncated — ${entry.size} bytes total]` : body;
      return [
        `**${entry.path}** _(${entry.mimeType || "text"}, ${formatSize(entry.size)})_`,
        "```",
        truncated,
        "```",
      ].join("\n");
    },
  },

  ls: {
    description: "List the children of a VFS directory.",
    usage: "/ls [path]",
    run: (args) => {
      const path = absPath(args.trim() || "/");
      const entry = getEntry(path);
      if (!entry) return `No such entry: \`${path}\``;
      if (!entry.isDir) {
        return `\`${path}\` is a file — try \`/stat ${path}\` or \`/read ${path}\`.`;
      }
      const children = listDir(path);
      if (children.length === 0) return `\`${path}\` is empty.`;
      const dirs = children.filter((c) => c.isDir).map((c) => `📁 ${c.name}/`);
      const files = children
        .filter((c) => !c.isDir)
        .map((c) => `📄 ${c.name}  _(${formatSize(c.size)})_`);
      return [`**${path}** — ${children.length} item${children.length === 1 ? "" : "s"}`, ...dirs, ...files].join("\n");
    },
  },

  stat: {
    description: "Show metadata for a VFS entry — mime, size, mtime, clock.",
    usage: "/stat <path>",
    run: (args) => {
      const path = absPath(args.trim());
      if (!path) return "Usage: `/stat <path>`";
      const entry = getEntry(path);
      if (!entry) return `No such entry: \`${path}\``;
      const lines = [
        `**${entry.path}**`,
        `- type: ${entry.isDir ? "directory" : "file"}`,
        `- mime: \`${entry.mimeType || "(none)"}\``,
        `- size: ${formatSize(entry.size)} (${entry.size} bytes)`,
        `- created: ${new Date(entry.createdAt).toLocaleString()}`,
        `- updated: ${new Date(entry.updatedAt).toLocaleString()}`,
        `- clock: ${entry.clock ?? 0}`,
      ];
      return lines.join("\n");
    },
  },

  find: {
    description: "Find VFS entries whose path or name contains the pattern (case-insensitive).",
    usage: "/find <pattern>",
    run: (args) => {
      const pattern = args.trim().toLowerCase();
      if (!pattern) return "Usage: `/find <pattern>`";
      const all = exportSnapshot();
      const hits = all.filter(
        (e) => e.path.toLowerCase().includes(pattern) || e.name.toLowerCase().includes(pattern),
      );
      if (hits.length === 0) return `No entries match \`${pattern}\`.`;
      const MAX = 25;
      const lines = hits
        .slice(0, MAX)
        .map((e) => `${e.isDir ? "📁" : "📄"} ${e.path}${e.isDir ? "/" : ""}`);
      const more = hits.length > MAX ? `\n… and ${hits.length - MAX} more.` : "";
      return [`**${hits.length}** match${hits.length === 1 ? "" : "es"} for \`${pattern}\`:`, ...lines].join("\n") + more;
    },
  },

  tree: {
    description: "Render the folder tree under a path (depth-limited).",
    usage: "/tree [path] [maxDepth=3]",
    run: (args) => {
      const parts = args.trim().split(/\s+/).filter(Boolean);
      const path = absPath(parts[0] ?? "/");
      const depthArg = Number.parseInt(parts[1] ?? "3", 10);
      const maxDepth = Number.isFinite(depthArg) && depthArg > 0 ? Math.min(depthArg, 6) : 3;
      const entry = getEntry(path);
      if (!entry) return `No such entry: \`${path}\``;
      if (!entry.isDir) return `\`${path}\` is a file.`;
      const lines: string[] = [`**${entry.path || "/"}**`];
      const walk = (p: string, depth: number, prefix: string) => {
        if (depth > maxDepth) return;
        const kids = listDir(p);
        kids.forEach((k, i) => {
          const last = i === kids.length - 1;
          const branch = last ? "└─ " : "├─ ";
          lines.push(`${prefix}${branch}${k.isDir ? "📁 " + k.name + "/" : "📄 " + k.name}`);
          if (k.isDir) walk(k.path, depth + 1, prefix + (last ? "   " : "│  "));
        });
      };
      walk(path, 1, "");
      const MAX_LINES = 80;
      if (lines.length > MAX_LINES) {
        return ["```", ...lines.slice(0, MAX_LINES), `… (truncated, ${lines.length - MAX_LINES} more lines)`, "```"].join("\n");
      }
      return ["```", ...lines, "```"].join("\n");
    },
  },

  storage: {
    description: "Show VFS quota usage + per-folder breakdown.",
    usage: "/storage",
    run: () => {
      const s = vfsStats();
      const lines = [
        `**Storage** — ${formatSize(s.totalBytes)} live, ${formatSize(s.trashBytes)} in trash, ${s.fileCount} files / ${s.dirCount} folders.`,
      ];
      if (s.byFolder.length > 0) {
        lines.push("", "Top folders:");
        for (const f of s.byFolder.slice(0, 8)) {
          lines.push(`- ${f.path} — ${formatSize(f.bytes)} (${f.count} files)`);
        }
      }
      return lines.join("\n");
    },
  },

  clock: {
    description: "Show the current VFS logical clock (used by diff-sync).",
    usage: "/clock",
    run: () => {
      const c = getLatestClock();
      const ts = getAllTombstones();
      const conflicts = listConflicts();
      const lines = [
        `Latest VFS clock: **${c}**`,
        `Tombstones tracked: **${ts.length}**`,
        `Pending conflicts: **${conflicts.length}**`,
        "",
        "The clock advances on every create / write / rename / move / delete and is the watermark used by the per-entry diff-sync protocol (`POST /api/v1/vfs/changes`). Tombstones record path-deletes so they propagate to the server even though deleted entries are no longer present locally. Conflicts are recorded when both this device and another edited the same path concurrently — visit Settings → Backend to resolve them.",
      ];
      return lines.join("\n");
    },
  },

  conflicts: {
    description: "List pending sync conflicts (concurrent edits on the same path).",
    usage: "/conflicts",
    run: () => {
      const conflicts = listConflicts();
      if (conflicts.length === 0) {
        return "No pending sync conflicts. Diff-sync's last-write-wins handled every recent change cleanly.";
      }
      const lines = conflicts.slice(0, 20).map((c) => {
        const tag = c.loserIsLocal ? "local edit lost" : "remote edit held back";
        return `- \`${c.path}\` — ${tag} (forked@${c.syncedClock}, winner@${c.winner.clock ?? 0}, loser@${c.loser.clock ?? 0})`;
      });
      const head = `**${conflicts.length}** pending conflict${conflicts.length === 1 ? "" : "s"}:`;
      const tail = conflicts.length > 20 ? `\n…and ${conflicts.length - 20} more (open Settings → Backend to see all).` : "";
      return [head, ...lines, "", "Resolve each via Settings → Backend → Sync conflicts (Keep local / Keep remote / dismiss)."].join("\n") + tail;
    },
  },

  apps: {
    description: "List installed CloudOS apps (built-in + user-added).",
    usage: "/apps",
    run: () => {
      const ms = listManifests();
      if (ms.length === 0) return "No app manifests installed.";
      const lines = ms.map((m) => `- ${m.icon ?? "🔹"} **${m.name}** _(${m.id})_${m.description ? ` — ${m.description}` : ""}`);
      return [`**${ms.length}** installed app${ms.length === 1 ? "" : "s"}:`, ...lines].join("\n");
    },
  },

  windows: {
    description: "List open windows on the active desktop.",
    usage: "/windows",
    run: () => {
      const wins = currentDesktopWindows();
      if (wins.length === 0) return "No open windows on this desktop.";
      const focused = focusedWindow();
      const lines = wins.map((w) => {
        const stateTag = w.state === "minimized" ? " — minimised" : w.state === "maximized" ? " — maximised" : w.state === "snapped" ? " — snapped" : "";
        return `- ${w.id === focused?.id ? "★" : " "} **${w.title}** _(${w.appId})_${stateTag}`;
      });
      return [`**${wins.length}** window${wins.length === 1 ? "" : "s"} on desktop "${currentDesktop()?.name ?? "?"}":`, ...lines].join("\n");
    },
  },

  desktops: {
    description: "List virtual desktops + which one is active.",
    usage: "/desktops",
    run: () => {
      const all = desktops();
      const cur = currentDesktop();
      const lines = all.map((d) => `- ${d.id === cur?.id ? "★" : " "} **${d.name}** (id ${d.id})`);
      return [`**${all.length}** desktop${all.length === 1 ? "" : "s"}:`, ...lines].join("\n");
    },
  },

  whoami: {
    description: "Show profile info (display name, email, avatar, bio).",
    usage: "/whoami",
    run: () => {
      return [
        `**${profile.displayName || "(no name set)"}** ${profile.avatar || ""}`,
        `- email: ${profile.email || "(none)"}`,
        profile.bio ? `- bio: ${profile.bio}` : "",
      ].filter(Boolean).join("\n");
    },
  },

  recent: {
    description: "Show recently launched apps.",
    usage: "/recent",
    run: () => {
      const r = recentApps();
      if (r.length === 0) return "No recent apps.";
      return ["**Recent apps:**", ...r.slice(0, 10).map((id) => `- ${id}`)].join("\n");
    },
  },

  now: {
    description: "Show current local date + time.",
    usage: "/now",
    run: () => `It is **${new Date().toLocaleString()}** on your device.`,
  },

  write: {
    description: "Create or overwrite a file. Asks for confirmation before writing.",
    usage: "/write <path> <content>",
    dangerous: true,
    run: (args) => {
      const trimmed = args.trim();
      if (!trimmed) return "Usage: `/write <path> <content>`";
      const space = trimmed.indexOf(" ");
      if (space === -1) {
        return "Usage: `/write <path> <content>` — provide content after the path.";
      }
      const rawPath = trimmed.slice(0, space).trim();
      const content = trimmed.slice(space + 1);
      if (!rawPath) return "Usage: `/write <path> <content>`";
      return prepareWrite(rawPath, content);
    },
  },

  mkdir: {
    description: "Create a directory. Asks for confirmation before creating.",
    usage: "/mkdir <path>",
    dangerous: true,
    run: (args) => {
      const rawPath = args.trim();
      if (!rawPath) return "Usage: `/mkdir <path>`";
      return prepareMkdir(rawPath);
    },
  },

  rm: {
    description:
      "Delete a file or directory. Default sends to /Trash; `--hard` permanently deletes. Asks for confirmation.",
    usage: "/rm [--hard] <path>",
    dangerous: true,
    run: (args) => {
      const tokens = args.trim().split(/\s+/).filter(Boolean);
      let hard = false;
      while (tokens.length > 0 && tokens[0].startsWith("--")) {
        const flag = tokens.shift();
        if (flag === "--hard") {
          hard = true;
        } else {
          return `Unknown flag \`${flag}\`. Usage: \`/rm [--hard] <path>\``;
        }
      }
      if (tokens.length === 0) return "Usage: `/rm [--hard] <path>`";
      return prepareRm(tokens.join(" "), hard);
    },
  },

  mv: {
    description:
      "Move or rename a file/directory. If <dst> is an existing directory, moves into it; otherwise renames. Asks for confirmation.",
    usage: "/mv <src> <dst>",
    dangerous: true,
    run: (args) => {
      const tokens = args.trim().split(/\s+/).filter(Boolean);
      if (tokens.length !== 2) {
        return "Usage: `/mv <src> <dst>` — exactly two paths required.";
      }
      return prepareMv(tokens[0], tokens[1]);
    },
  },
};

/**
 * Validate args for `/write` and build a `ConfirmationPayload`. Returns
 * an error string instead if validation fails. Shared between the
 * slash command parser and the typed tool runtime so both layers
 * enforce identical rules.
 */
function prepareWrite(rawPath: string, content: string): ConfirmationPayload | string {
  if (!rawPath) return "Path is required.";
  const path = absPath(rawPath);
  if (path === "/") return "Refusing to /write to the VFS root.";
  const existing = getEntry(path);
  if (existing?.isDir) return `\`${path}\` is a directory — refusing to overwrite.`;
  return {
    kind: "write",
    path,
    content,
    existingSize: existing ? existing.size : null,
  };
}

/**
 * Validate args for `/mkdir` and build a `ConfirmationPayload`. See
 * `prepareWrite` for the shared-logic motivation.
 */
function prepareMkdir(rawPath: string): ConfirmationPayload | string {
  if (!rawPath) return "Path is required.";
  const path = absPath(rawPath);
  if (path === "/") return "Cannot /mkdir the VFS root — it already exists.";
  if (getEntry(path)) return `\`${path}\` already exists.`;
  const lastSlash = path.lastIndexOf("/");
  const parentPath = lastSlash === 0 ? "/" : path.slice(0, lastSlash);
  const name = path.slice(lastSlash + 1);
  if (!name) return `Invalid path: \`${path}\`.`;
  const parent = getEntry(parentPath);
  if (!parent) return `Parent directory \`${parentPath}\` does not exist.`;
  if (!parent.isDir) return `Parent path \`${parentPath}\` is a file, not a directory.`;
  return { kind: "mkdir", path, parentPath, name };
}

/**
 * Validate args for `/rm [--hard]` and build a `ConfirmationPayload`.
 * Caller is responsible for parsing the `--hard` flag.
 */
function prepareRm(rawPath: string, hard: boolean): ConfirmationPayload | string {
  if (!rawPath) return "Path is required.";
  const path = absPath(rawPath);
  if (path === "/") return "Refusing to /rm the VFS root.";
  const entry = getEntry(path);
  if (!entry) return `No such entry: \`${path}\``;
  let descendantCount = 0;
  if (entry.isDir) {
    const all = exportSnapshot();
    const prefix = `${path}/`;
    descendantCount = all.filter((e) => e.path.startsWith(prefix)).length;
  }
  return {
    kind: "rm",
    path,
    hard,
    isDir: entry.isDir,
    descendantCount,
  };
}

/**
 * Validate args for `/mv` and build a `ConfirmationPayload`. Determines
 * the final target path based on whether `dst` is an existing directory
 * (move-into) or not (rename / move+rename).
 */
function prepareMv(rawSrc: string, rawDst: string): ConfirmationPayload | string {
  if (!rawSrc || !rawDst) return "Source and destination are required.";
  const srcPath = absPath(rawSrc);
  const dstRaw = absPath(rawDst);
  if (srcPath === "/") return "Refusing to /mv the VFS root.";
  const src = getEntry(srcPath);
  if (!src) return `No such entry: \`${srcPath}\``;

  const dst = getEntry(dstRaw);
  let finalPath: string;
  let mode: "rename" | "move" | "move+rename";

  if (dst?.isDir) {
    // Move src into dst directory, preserving src's name.
    finalPath = dstRaw === "/" ? `/${src.name}` : `${dstRaw}/${src.name}`;
    mode = "move";
  } else if (dst && !dst.isDir) {
    return `\`${dstRaw}\` already exists as a file — refusing to overwrite.`;
  } else {
    // Treat dst as a full target path (rename / move+rename).
    const lastSlash = dstRaw.lastIndexOf("/");
    const parentPath = lastSlash === 0 ? "/" : dstRaw.slice(0, lastSlash);
    const newName = dstRaw.slice(lastSlash + 1);
    if (!newName) return `Invalid destination path: \`${dstRaw}\`.`;
    const parent = getEntry(parentPath);
    if (!parent) return `Destination directory \`${parentPath}\` does not exist.`;
    if (!parent.isDir) return `Destination parent \`${parentPath}\` is a file, not a directory.`;
    finalPath = dstRaw;
    const srcLastSlash = srcPath.lastIndexOf("/");
    const srcParent = srcLastSlash === 0 ? "/" : srcPath.slice(0, srcLastSlash);
    mode = srcParent === parentPath ? "rename" : "move+rename";
  }

  if (finalPath === srcPath) return "Source and destination are the same — nothing to do.";
  if (finalPath.startsWith(`${srcPath}/`)) {
    return `Cannot move \`${srcPath}\` into its own descendant \`${finalPath}\`.`;
  }
  if (getEntry(finalPath)) return `\`${finalPath}\` already exists.`;

  return { kind: "mv", srcPath, finalPath, mode };
}

function helpText(): string {
  const lines = [
    "**CloudOS Assistant — slash commands** (work in every provider mode, including offline Echo):",
    "",
  ];
  const names = Object.keys(commands).sort();
  for (const name of names) {
    const c = commands[name];
    const marker = c.dangerous ? "⚠️ " : "";
    lines.push(`- ${marker}\`${c.usage}\` — ${c.description}`);
  }
  lines.push("");
  lines.push(
    "⚠️ marks mutating commands — they ask for Run / Cancel confirmation in chat unless 'Always allow dangerous commands' is enabled in Settings.",
  );
  lines.push("");
  lines.push(
    "Anything that doesn't start with `/` is forwarded to the configured LLM (or echoed in offline mode).",
  );
  return lines.join("\n");
}

/** Coerce a maybe-relative path into an absolute one rooted at "/". */
function absPath(p: string): string {
  if (!p) return "/";
  return p.startsWith("/") ? p : `/${p}`;
}

/**
 * Render a human-readable preview of what would happen if the user
 * confirms a queued mutation. Used as the assistant message body
 * shown above the Run / Cancel buttons.
 */
export function describeConfirmation(p: ConfirmationPayload): string {
  switch (p.kind) {
    case "write": {
      const sizeLabel = `${p.content.length} bytes`;
      if (p.existingSize === null) {
        return `Run \`/write\` to **create** \`${p.path}\` (${sizeLabel})?`;
      }
      return `Run \`/write\` to **overwrite** \`${p.path}\` — replacing ${p.existingSize} bytes with ${sizeLabel}?`;
    }
    case "mkdir":
      return `Run \`/mkdir\` to create directory \`${p.path}\`?`;
    case "rm": {
      const target = p.isDir
        ? `directory \`${p.path}\`${p.descendantCount > 0 ? ` (and its ${p.descendantCount} descendant${p.descendantCount === 1 ? "" : "s"})` : ""}`
        : `file \`${p.path}\``;
      if (p.hard) {
        return `Run \`/rm --hard\` to **permanently delete** ${target}? This cannot be undone.`;
      }
      return `Run \`/rm\` to move ${target} to \`/Trash\`? You can restore it from Settings → Trash.`;
    }
    case "mv":
      if (p.mode === "rename") {
        return `Run \`/mv\` to rename \`${p.srcPath}\` → \`${p.finalPath}\`?`;
      }
      if (p.mode === "move") {
        return `Run \`/mv\` to move \`${p.srcPath}\` into \`${p.finalPath}\`?`;
      }
      return `Run \`/mv\` to move + rename \`${p.srcPath}\` → \`${p.finalPath}\`?`;
  }
}

/**
 * Apply a confirmed mutation to the VFS and return a human-readable
 * outcome string suitable for replacing the assistant's preview
 * message body. Re-validates the live VFS state — if the world
 * changed between preview and confirmation (concurrent edit, sync
 * conflict), returns an error string instead of silently doing the
 * wrong thing.
 */
export function executeConfirmedAction(p: ConfirmationPayload): string {
  switch (p.kind) {
    case "write": {
      const existing = getEntry(p.path);
      if (existing?.isDir) {
        return `Aborted: \`${p.path}\` is now a directory (changed since preview).`;
      }
      const result = writeFile(p.path, p.content);
      if (!result) return `Aborted: failed to write \`${p.path}\`.`;
      const verb = p.existingSize === null ? "Created" : "Overwrote";
      return `${verb} \`${p.path}\` (${p.content.length} bytes).`;
    }
    case "mkdir": {
      if (getEntry(p.path)) {
        return `Aborted: \`${p.path}\` already exists (changed since preview).`;
      }
      const parent = getEntry(p.parentPath);
      if (!parent || !parent.isDir) {
        return `Aborted: parent \`${p.parentPath}\` is no longer a directory.`;
      }
      createDir(p.parentPath, p.name);
      return `Created directory \`${p.path}\`.`;
    }
    case "rm": {
      const entry = getEntry(p.path);
      if (!entry) return `Aborted: \`${p.path}\` no longer exists.`;
      if (p.hard) {
        deleteEntry(p.path);
        return `Permanently deleted \`${p.path}\`.`;
      }
      const trashed = moveToTrash(p.path);
      if (!trashed) return `Aborted: failed to move \`${p.path}\` to /Trash.`;
      return `Moved \`${p.path}\` to \`${trashed.entry.path}\`. Restore from Settings → Trash if needed.`;
    }
    case "mv": {
      const src = getEntry(p.srcPath);
      if (!src) return `Aborted: \`${p.srcPath}\` no longer exists.`;
      if (getEntry(p.finalPath)) {
        return `Aborted: \`${p.finalPath}\` already exists (changed since preview).`;
      }
      if (p.mode === "rename") {
        const lastSlash = p.finalPath.lastIndexOf("/");
        const newName = p.finalPath.slice(lastSlash + 1);
        const result = renameEntry(p.srcPath, newName);
        if (!result) return `Aborted: rename of \`${p.srcPath}\` failed.`;
        return `Renamed \`${p.srcPath}\` → \`${p.finalPath}\`.`;
      }
      // For "move" and "move+rename", first move into the destination
      // parent directory, then (if needed) rename to the requested name.
      const lastSlash = p.finalPath.lastIndexOf("/");
      const destDirPath = lastSlash === 0 ? "/" : p.finalPath.slice(0, lastSlash);
      const intendedName = p.finalPath.slice(lastSlash + 1);
      const moved = moveEntry(p.srcPath, destDirPath);
      if (!moved) return `Aborted: move of \`${p.srcPath}\` into \`${destDirPath}\` failed.`;
      if (moved.name !== intendedName) {
        const renamed = renameEntry(moved.path, intendedName);
        if (!renamed) {
          return `Moved \`${p.srcPath}\` to \`${moved.path}\` but rename to \`${intendedName}\` failed.`;
        }
        return `Moved + renamed \`${p.srcPath}\` → \`${p.finalPath}\`.`;
      }
      return `Moved \`${p.srcPath}\` → \`${p.finalPath}\`.`;
    }
  }
}

export interface SlashCommandOptions {
  /**
   * When true, dangerous commands run immediately instead of returning
   * a `ConfirmationPayload`. Sourced from the user's
   * "Always allow dangerous commands" setting.
   */
  alwaysAllow?: boolean;
}

/**
 * If `text` starts with a recognised slash command, execute it and
 * return the synthesised assistant reply. Otherwise returns
 * `{ handled: false, reply: "" }` and the caller should proceed with
 * the configured LLM provider.
 *
 * For dangerous commands (`/write`, `/mkdir`, `/rm`, `/mv`), the
 * default is to return a `ConfirmationPayload` on `ToolResult` so the
 * UI can render Run / Cancel — the mutation does NOT happen until the
 * caller explicitly invokes `executeConfirmedAction(payload)`. Pass
 * `{ alwaysAllow: true }` to skip that gate.
 */
export async function tryExecuteSlashCommand(
  text: string,
  opts: SlashCommandOptions = {},
): Promise<ToolResult> {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return { handled: false, reply: "" };
  const space = trimmed.indexOf(" ");
  const cmdName = (space === -1 ? trimmed.slice(1) : trimmed.slice(1, space)).toLowerCase();
  const args = space === -1 ? "" : trimmed.slice(space + 1);
  const cmd = commands[cmdName];
  if (!cmd) {
    return {
      handled: true,
      reply: `Unknown command \`/${cmdName}\`. Type \`/help\` to see what I can do.`,
    };
  }
  try {
    const result = await cmd.run(args);
    if (typeof result === "string") {
      return { handled: true, reply: result };
    }
    // Command returned a ConfirmationPayload describing a queued
    // mutation. If the caller opted into always-allow, run it now;
    // otherwise hand it back so the UI can render Run / Cancel.
    if (opts.alwaysAllow) {
      const outcome = executeConfirmedAction(result);
      return { handled: true, reply: outcome };
    }
    return {
      handled: true,
      reply: describeConfirmation(result),
      confirmation: result,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { handled: true, reply: `Command \`/${cmdName}\` failed: ${msg}` };
  }
}

/** Exposed for tests / inspection. */
export function listSlashCommands(): {
  name: string;
  usage: string;
  description: string;
  dangerous: boolean;
}[] {
  return Object.entries(commands).map(([name, c]) => ({
    name,
    usage: c.usage,
    description: c.description,
    dangerous: c.dangerous === true,
  }));
}

// ---------------------------------------------------------------------------
// Typed tool runtime (LLM tool-calling)
// ---------------------------------------------------------------------------
//
// The slash command parser above is for humans typing `/cmd args` in chat.
// Below is a parallel surface for LLMs invoking the same capabilities via
// OpenAI / Anthropic / Ollama-style structured tool calls. Both layers
// share the dangerous-command `prepare*` helpers so validation rules
// stay in lock-step.
//
// The OpenAI tools[] schema produced by `getToolsSchema()` fits OpenAI's
// `chat/completions` `tools` parameter as well as Ollama's compatible
// `tools` field on `/api/chat` (Ollama copies OpenAI's shape verbatim).
// Anthropic uses a slightly different shape — adapt before sending; the
// tool name + parameters JSON are reusable.

/**
 * One typed tool the LLM can invoke. Read-only tools return a plain
 * string for direct injection into the tool-result message back to
 * the LLM. Mutating tools return a `ConfirmationPayload` that the
 * caller funnels through the same Run / Cancel gate as the slash
 * commands (or executes immediately when `dangerousAlwaysAllow` is on).
 */
interface ToolDefinition {
  name: string;
  description: string;
  /** OpenAI/JSON-schema "parameters" object. Empty `properties` = no args. */
  parameters: {
    type: "object";
    properties: Record<
      string,
      {
        type: "string" | "number" | "integer" | "boolean";
        description: string;
        enum?: readonly string[];
      }
    >;
    required?: readonly string[];
  };
  /** Mutating tools gated by the Run / Cancel confirmation flow. */
  dangerous: boolean;
  /**
   * Run the tool against the live VFS / desktop state. Read-only tools
   * MUST return a string; mutating tools return either a
   * `ConfirmationPayload` (queued) or an error string (validation
   * failure — no payload, no mutation).
   */
  run: (
    params: Record<string, unknown>,
  ) => string | ConfirmationPayload | Promise<string | ConfirmationPayload>;
}

const tools: ToolDefinition[] = [
  // --- Read-only VFS / desktop tools ----------------------------------
  {
    name: "read_file",
    description: "Read the contents of a VFS file. Returns the body up to a 4 KB cap.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute VFS path, e.g. /Documents/notes.md" },
      },
      required: ["path"],
    },
    dangerous: false,
    run: (params) => {
      const path = String(params.path ?? "").trim();
      if (!path) return "path is required.";
      const entry = getEntry(absPath(path));
      if (!entry) return `No such entry: ${path}`;
      if (entry.isDir) return `${entry.path} is a directory; use list_dir instead.`;
      const body = entry.content ?? "";
      const MAX = 4000;
      if (body.length > MAX) {
        return `${body.slice(0, MAX)}\n…[truncated; ${entry.size} bytes total]`;
      }
      return body;
    },
  },
  {
    name: "list_dir",
    description: "List children of a VFS directory. Returns name, kind (file|dir), and size.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute VFS path. Defaults to /." },
      },
    },
    dangerous: false,
    run: (params) => {
      const path = absPath(String(params.path ?? "/").trim() || "/");
      const entry = getEntry(path);
      if (!entry) return `No such entry: ${path}`;
      if (!entry.isDir) return `${path} is a file. Use read_file or stat instead.`;
      const children = listDir(path);
      if (children.length === 0) return `${path} is empty.`;
      return children
        .map((c) => `${c.isDir ? "dir" : "file"}\t${c.name}${c.isDir ? "/" : ""}\t${c.size}`)
        .join("\n");
    },
  },
  {
    name: "stat",
    description: "Show metadata for a VFS entry: kind, mime, size, mtime, clock.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute VFS path." },
      },
      required: ["path"],
    },
    dangerous: false,
    run: (params) => {
      const path = absPath(String(params.path ?? "").trim());
      if (!path || path === "/") {
        const entry = getEntry("/");
        if (!entry) return "VFS root has no entry.";
        return `path=/  type=directory  size=${entry.size}`;
      }
      const entry = getEntry(path);
      if (!entry) return `No such entry: ${path}`;
      return [
        `path=${entry.path}`,
        `type=${entry.isDir ? "directory" : "file"}`,
        `mime=${entry.mimeType || "(none)"}`,
        `size=${entry.size}`,
        `created=${new Date(entry.createdAt).toISOString()}`,
        `updated=${new Date(entry.updatedAt).toISOString()}`,
        `clock=${entry.clock ?? 0}`,
      ].join("\n");
    },
  },
  {
    name: "find",
    description:
      "Find VFS entries whose path or name contains the given pattern (case-insensitive substring match).",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Substring to search for." },
      },
      required: ["pattern"],
    },
    dangerous: false,
    run: (params) => {
      const pattern = String(params.pattern ?? "").trim().toLowerCase();
      if (!pattern) return "pattern is required.";
      const all = exportSnapshot();
      const hits = all.filter(
        (e) => e.path.toLowerCase().includes(pattern) || e.name.toLowerCase().includes(pattern),
      );
      if (hits.length === 0) return `No matches for ${pattern}.`;
      const MAX = 25;
      const lines = hits
        .slice(0, MAX)
        .map((e) => `${e.isDir ? "dir" : "file"}\t${e.path}${e.isDir ? "/" : ""}`);
      const more = hits.length > MAX ? `\n…and ${hits.length - MAX} more` : "";
      return `${hits.length} match(es):\n${lines.join("\n")}${more}`;
    },
  },
  {
    name: "storage_summary",
    description:
      "Summarise VFS quota usage: total live bytes, trash bytes, file count, dir count, top folders.",
    parameters: { type: "object", properties: {} },
    dangerous: false,
    run: () => {
      const s = vfsStats();
      const lines = [
        `total=${s.totalBytes}  trash=${s.trashBytes}  files=${s.fileCount}  dirs=${s.dirCount}`,
      ];
      for (const f of s.byFolder.slice(0, 8)) {
        lines.push(`  ${f.path}\t${f.bytes}`);
      }
      return lines.join("\n");
    },
  },
  {
    name: "list_apps",
    description: "List installed CloudOS apps (id and name).",
    parameters: { type: "object", properties: {} },
    dangerous: false,
    run: () => {
      const ms = listManifests();
      if (ms.length === 0) return "No apps installed.";
      return ms.map((m) => `${m.id}\t${m.name}`).join("\n");
    },
  },
  {
    name: "list_windows",
    description: "List currently open windows on the active desktop with focus state.",
    parameters: { type: "object", properties: {} },
    dangerous: false,
    run: () => {
      const ws = currentDesktopWindows();
      if (ws.length === 0) return "No windows open on the active desktop.";
      const focusedId = focusedWindow()?.id ?? null;
      return ws
        .map((w) => `${w.id === focusedId ? "*" : " "} ${w.appId}\t${w.title || "(untitled)"}`)
        .join("\n");
    },
  },
  {
    name: "list_desktops",
    description: "List virtual desktops and which one is currently active.",
    parameters: { type: "object", properties: {} },
    dangerous: false,
    run: () => {
      const list = desktops();
      const cur = currentDesktop()?.id ?? null;
      return list.map((d) => `${d.id === cur ? "*" : " "} ${d.id}\t${d.name}`).join("\n");
    },
  },
  {
    name: "now",
    description: "Return the current local date and time as an ISO string.",
    parameters: { type: "object", properties: {} },
    dangerous: false,
    run: () => new Date().toISOString(),
  },
  {
    name: "vfs_clock",
    description: "Return the latest VFS clock value (sync state).",
    parameters: { type: "object", properties: {} },
    dangerous: false,
    run: () => `clock=${getLatestClock()}\ntombstones=${getAllTombstones().length}`,
  },
  {
    name: "list_conflicts",
    description: "List unresolved sync conflicts on VFS entries.",
    parameters: { type: "object", properties: {} },
    dangerous: false,
    run: () => {
      const list = listConflicts();
      if (list.length === 0) return "No conflicts.";
      return list
        .map(
          (c) =>
            `${c.path}\tloserIsLocal=${c.loserIsLocal}\twinner.clock=${c.winner.clock ?? 0}\tloser.clock=${c.loser.clock ?? 0}`,
        )
        .join("\n");
    },
  },
  {
    name: "whoami",
    description: "Return the current user's profile (display name + email + bio).",
    parameters: { type: "object", properties: {} },
    dangerous: false,
    run: () => {
      return [
        `displayName=${profile.displayName}`,
        `email=${profile.email || "(unset)"}`,
        `avatar=${profile.avatar}`,
        `bio=${profile.bio || "(empty)"}`,
      ].join("\n");
    },
  },
  {
    name: "recent_apps",
    description: "Return the user's recently launched app ids (most recent first).",
    parameters: { type: "object", properties: {} },
    dangerous: false,
    run: () => {
      const r = recentApps();
      if (r.length === 0) return "No recent apps.";
      return r.slice(0, 10).join("\n");
    },
  },

  // --- Mutating tools (gated by the same Run / Cancel flow) ----------
  {
    name: "write_file",
    description:
      "Create or overwrite a VFS file. Returns a confirmation payload — the caller must run executeConfirmedAction (or pass alwaysAllow=true) for the write to actually happen.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute VFS path." },
        content: { type: "string", description: "Full file body." },
      },
      required: ["path", "content"],
    },
    dangerous: true,
    run: (params) =>
      prepareWrite(String(params.path ?? "").trim(), String(params.content ?? "")),
  },
  {
    name: "mkdir",
    description:
      "Create a VFS directory. Returns a confirmation payload (see write_file note).",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute VFS path." },
      },
      required: ["path"],
    },
    dangerous: true,
    run: (params) => prepareMkdir(String(params.path ?? "").trim()),
  },
  {
    name: "rm",
    description:
      "Move a VFS entry to /Trash by default; pass hard=true for permanent delete. Returns a confirmation payload.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute VFS path." },
        hard: {
          type: "boolean",
          description: "If true, permanently delete instead of moving to /Trash.",
        },
      },
      required: ["path"],
    },
    dangerous: true,
    run: (params) =>
      prepareRm(String(params.path ?? "").trim(), Boolean(params.hard)),
  },
  {
    name: "mv",
    description:
      "Move a VFS entry into a destination directory, or rename it if the destination doesn't exist. Returns a confirmation payload.",
    parameters: {
      type: "object",
      properties: {
        src: { type: "string", description: "Absolute VFS path of the source." },
        dst: {
          type: "string",
          description:
            "Absolute VFS path of the destination — an existing directory (move-into) or a new path (rename / move+rename).",
        },
      },
      required: ["src", "dst"],
    },
    dangerous: true,
    run: (params) =>
      prepareMv(String(params.src ?? "").trim(), String(params.dst ?? "").trim()),
  },
];

/**
 * OpenAI / Ollama `tools[]` parameter shape. Anthropic uses a different
 * top-level wrapper but the inner schema is the same; adapt as needed.
 */
export interface ToolSchemaEntry {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: ToolDefinition["parameters"];
  };
}

/**
 * Returns the OpenAI/Ollama-compatible `tools[]` parameter for the
 * current toolset. Use this in the request body sent to providers
 * that support function calling.
 */
export function getToolsSchema(): ToolSchemaEntry[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

/** Exposed for tests / inspection. */
export function listTools(): { name: string; description: string; dangerous: boolean }[] {
  return tools.map((t) => ({ name: t.name, description: t.description, dangerous: t.dangerous }));
}

export interface RunToolResult {
  /**
   * Text result intended for the tool-result message back to the LLM
   * (read-only success), the user-visible preview text (mutating, gated),
   * or the outcome message (mutating, alwaysAllow=true), or the error
   * message (validation failure / unknown tool / handler threw).
   */
  content: string;
  /**
   * Set when a mutating tool was queued and the gate has NOT yet been
   * cleared. The chat UI should render Run / Cancel and call
   * `executeConfirmedAction(payload)` only on Run.
   */
  confirmation?: ConfirmationPayload;
  /** True if the tool was found and didn't throw. */
  ok: boolean;
}

/**
 * Run a single LLM-issued tool call. For dangerous tools, the default
 * behaviour is to return the `ConfirmationPayload` so the caller can
 * surface Run / Cancel to the user; pass `{ alwaysAllow: true }` to
 * mutate immediately (sourced from `cfg.dangerousAlwaysAllow`).
 */
export async function runTool(
  name: string,
  params: Record<string, unknown>,
  opts: SlashCommandOptions = {},
): Promise<RunToolResult> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) return { content: `Unknown tool: ${name}`, ok: false };
  let result: string | ConfirmationPayload;
  try {
    result = await tool.run(params);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { content: `Tool ${name} failed: ${msg}`, ok: false };
  }
  if (typeof result === "string") {
    return { content: result, ok: true };
  }
  // Mutating: respect the alwaysAllow gate or hand back the payload.
  if (opts.alwaysAllow) {
    return { content: executeConfirmedAction(result), ok: true };
  }
  return { content: describeConfirmation(result), confirmation: result, ok: true };
}
