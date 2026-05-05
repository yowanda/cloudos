import { focusWindow, openWindow, windowStore, closeWindow, focusedWindow, snapFocusedWindow, toggleFocusedMaximize, minimizeFocusedWindow } from "../stores/window-store";
import { lockScreen } from "../stores/auth-store";
import { emptyTrash } from "../vfs/vfs";
import { availableThemes, setActiveTheme } from "../stores/theme-store";
import { desktops, switchDesktop, nextDesktop, prevDesktop } from "../stores/desktop-store";
import { jumpToSettings, type SettingsPageId } from "./settings-nav";
import { soundEnabled, setSoundEnabled } from "./sound-manager";
import { listManifests } from "./app-manifest";
import { notify } from "../stores/notification-store";

/**
 * A Spotlight "command" — a system action that's discoverable through
 * search the same way apps and files are. Commands carry a list of
 * keywords (synonyms) so users can type whatever comes to mind.
 */
export interface CloudOSCommand {
  id: string;
  title: string;
  /** Short description shown under the title in Spotlight. */
  subtitle: string;
  icon: string;
  /** Extra terms that should match this command, beyond the title. */
  keywords: string[];
  /** Imperative verb form, used by Spotlight when title alone is too generic. */
  run: () => void;
}

function ensureSettingsOpen(page?: SettingsPageId) {
  if (page) jumpToSettings(page);
  const existing = windowStore.windows.find((w) => w.appId === "com.cloudos.settings");
  if (existing) {
    focusWindow(existing.id);
  } else {
    const m = listManifests().find((x) => x.id === "com.cloudos.settings");
    openWindow({
      appId: "com.cloudos.settings",
      title: "Settings",
      icon: "⚙️",
      width: m?.window?.width,
      height: m?.window?.height,
      resizable: m?.window?.resizable,
      minWidth: m?.window?.minWidth,
      minHeight: m?.window?.minHeight,
    });
  }
}

const settingsPages: { page: SettingsPageId; title: string; icon: string; keywords: string[] }[] = [
  { page: "appearance", title: "Settings · Appearance", icon: "🎨", keywords: ["theme", "color", "ui"] },
  { page: "wallpaper", title: "Settings · Wallpaper", icon: "🖼️", keywords: ["background", "desktop"] },
  { page: "sound", title: "Settings · Sound", icon: "🔊", keywords: ["audio", "volume"] },
  { page: "account", title: "Settings · Account", icon: "👤", keywords: ["profile", "user"] },
  { page: "apps", title: "Settings · Apps & Permissions", icon: "📦", keywords: ["permissions", "manage"] },
  { page: "keyboard", title: "Settings · Keyboard", icon: "⌨️", keywords: ["shortcut"] },
  { page: "storage", title: "Settings · Storage", icon: "💾", keywords: ["disk", "trash", "quota"] },
  { page: "backend", title: "Settings · Backend", icon: "🔗", keywords: ["server", "api"] },
  { page: "about", title: "Settings · About", icon: "ℹ️", keywords: ["version"] },
];

/**
 * Returns the full list of system commands. Re-evaluated on every
 * search so theme/desktop additions show up immediately.
 */
export function listCommands(): CloudOSCommand[] {
  const cmds: CloudOSCommand[] = [];

  // ─── Window-management ─────────────────────────────────────────────
  cmds.push(
    {
      id: "window.close-focused",
      title: "Close focused window",
      subtitle: "Closes whichever window currently has focus",
      icon: "✕",
      keywords: ["kill", "quit", "close", "x"],
      run: () => {
        const w = focusedWindow();
        if (w) closeWindow(w.id);
        else notify({ title: "No focused window", message: "Click a window first.", type: "warning", icon: "🪟" });
      },
    },
    {
      id: "window.maximize-focused",
      title: "Maximize focused window",
      subtitle: "Toggle maximize on the active window",
      icon: "🗖",
      keywords: ["fullscreen", "expand", "grow"],
      run: () => toggleFocusedMaximize(),
    },
    {
      id: "window.minimize-focused",
      title: "Minimize focused window",
      subtitle: "Send the active window to the taskbar",
      icon: "🗕",
      keywords: ["hide", "shrink"],
      run: () => minimizeFocusedWindow(),
    },
    {
      id: "window.snap.left",
      title: "Snap window to left half",
      subtitle: "Equivalent to Win + ←",
      icon: "◧",
      keywords: ["tile", "left", "half"],
      run: () => snapFocusedWindow("left"),
    },
    {
      id: "window.snap.right",
      title: "Snap window to right half",
      subtitle: "Equivalent to Win + →",
      icon: "◨",
      keywords: ["tile", "right", "half"],
      run: () => snapFocusedWindow("right"),
    },
  );

  // ─── System ────────────────────────────────────────────────────────
  cmds.push(
    {
      id: "system.reload",
      title: "Reload CloudOS",
      subtitle: "Hard reloads the shell. Unsaved state will be lost.",
      icon: "🔁",
      keywords: ["restart", "refresh", "reboot"],
      run: () => window.location.reload(),
    },
    {
      id: "system.lock",
      title: "Lock Screen",
      subtitle: "Equivalent to Ctrl+L",
      icon: "🔒",
      keywords: ["lock", "screen", "logout"],
      run: () => lockScreen(),
    },
    {
      id: "system.toggle-sound",
      title: soundEnabled() ? "Mute system sounds" : "Unmute system sounds",
      subtitle: "Toggle the WebAudio sound effects on/off",
      icon: soundEnabled() ? "🔇" : "🔊",
      keywords: ["mute", "audio", "volume"],
      run: () => setSoundEnabled(!soundEnabled()),
    },
    {
      id: "system.empty-trash",
      title: "Empty Trash",
      subtitle: "Permanently delete every item in the Trash",
      icon: "🗑️",
      keywords: ["delete", "purge", "clear"],
      run: () => {
        const removed = emptyTrash();
        notify({
          title: "Trash emptied",
          message: removed > 0 ? `Removed ${removed} item${removed === 1 ? "" : "s"}` : "Trash was already empty",
          type: removed > 0 ? "success" : "info",
          icon: "🗑️",
        });
      },
    },
  );

  // ─── Settings deep-links ───────────────────────────────────────────
  for (const sp of settingsPages) {
    cmds.push({
      id: `settings.${sp.page}`,
      title: sp.title,
      subtitle: "Open Settings on this page",
      icon: sp.icon,
      keywords: ["settings", sp.page, ...sp.keywords],
      run: () => ensureSettingsOpen(sp.page),
    });
  }

  // ─── Theme switcher ────────────────────────────────────────────────
  for (const t of availableThemes()) {
    cmds.push({
      id: `theme.set.${t.id}`,
      title: `Switch theme: ${t.name}`,
      subtitle: t.kind === "builtin" ? "Built-in theme" : "Imported theme",
      icon: "🎨",
      keywords: ["theme", t.id, t.base, t.kind],
      run: () => {
        setActiveTheme(t.id);
        notify({ title: "Theme switched", message: `Activated "${t.name}"`, type: "success", icon: "🎨" });
      },
    });
  }

  // ─── Workspace / desktop switcher ──────────────────────────────────
  cmds.push(
    {
      id: "workspace.next",
      title: "Switch to next workspace",
      subtitle: "Equivalent to Ctrl+Alt+→",
      icon: "▶️",
      keywords: ["desktop", "workspace", "next"],
      run: () => nextDesktop(),
    },
    {
      id: "workspace.prev",
      title: "Switch to previous workspace",
      subtitle: "Equivalent to Ctrl+Alt+←",
      icon: "◀️",
      keywords: ["desktop", "workspace", "prev"],
      run: () => prevDesktop(),
    },
  );
  for (const d of desktops()) {
    cmds.push({
      id: `workspace.switch.${d.id}`,
      title: `Switch to workspace: ${d.name}`,
      subtitle: `Workspace #${d.id + 1}`,
      icon: "🪟",
      keywords: ["desktop", "workspace", d.name.toLowerCase(), String(d.id + 1)],
      run: () => switchDesktop(d.id),
    });
  }

  return cmds;
}

/** Score a command against a query. 0 = no match. */
export function commandScore(query: string, c: CloudOSCommand): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const title = c.title.toLowerCase();
  if (title === q) return 1000;
  if (title.startsWith(q)) return 500;
  if (title.includes(q)) return 250;
  for (const kw of c.keywords) {
    const k = kw.toLowerCase();
    if (k === q) return 200;
    if (k.startsWith(q)) return 150;
    if (k.includes(q)) return 80;
  }
  return 0;
}
