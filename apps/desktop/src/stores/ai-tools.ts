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
  exportSnapshot,
  formatSize,
  getEntry,
  getLatestClock,
  listDir,
  vfsStats,
} from "../vfs/vfs";
import { listManifests } from "../core/app-manifest";
import { profile } from "./profile-store";
import { recentApps } from "./recents-store";
import { currentDesktopWindows, focusedWindow } from "./window-store";
import { currentDesktop, desktops } from "./desktop-store";

export interface ToolResult {
  /** True if the input was handled as a slash command (LLM should be skipped). */
  handled: boolean;
  /** The reply to surface. Multi-line text. Empty when handled=false. */
  reply: string;
}

interface CommandHandler {
  /** Short human description for `/help`. */
  description: string;
  /** Sample usage shown in `/help`. */
  usage: string;
  /** The actual handler. Receives the raw arg string after the command name. */
  run: (args: string) => string | Promise<string>;
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
      return `Latest VFS clock: **${c}**. Clock advances on every create / write / rename / move / delete and is the watermark used by the per-entry diff-sync protocol (\`POST /api/v1/vfs/changes\`).`;
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
};

function helpText(): string {
  const lines = [
    "**CloudOS Assistant — slash commands** (work in every provider mode, including offline Echo):",
    "",
  ];
  const names = Object.keys(commands).sort();
  for (const name of names) {
    const c = commands[name];
    lines.push(`- \`${c.usage}\` — ${c.description}`);
  }
  lines.push("");
  lines.push("Anything that doesn't start with `/` is forwarded to the configured LLM (or echoed in offline mode).");
  return lines.join("\n");
}

/** Coerce a maybe-relative path into an absolute one rooted at "/". */
function absPath(p: string): string {
  if (!p) return "/";
  return p.startsWith("/") ? p : `/${p}`;
}

/**
 * If `text` starts with a recognised slash command, execute it and
 * return the synthesised assistant reply. Otherwise returns
 * `{ handled: false, reply: "" }` and the caller should proceed with
 * the configured LLM provider.
 */
export async function tryExecuteSlashCommand(text: string): Promise<ToolResult> {
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
    const reply = await cmd.run(args);
    return { handled: true, reply };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { handled: true, reply: `Command \`/${cmdName}\` failed: ${msg}` };
  }
}

/** Exposed for tests / inspection. */
export function listSlashCommands(): { name: string; usage: string; description: string }[] {
  return Object.entries(commands).map(([name, c]) => ({
    name,
    usage: c.usage,
    description: c.description,
  }));
}
