import { Component, For, createMemo, createSignal, Show, onCleanup, onMount } from "solid-js";
import {
  theme,
  setTheme,
  accentColor,
  setAccentColor,
  wallpaper,
  setWallpaper,
  availableThemes,
  setActiveTheme,
  exportThemeToJSON,
  importThemeFromJSON,
  removeCustomTheme,
} from "../stores/theme-store";
import type { CloudOSTheme } from "../theme/types";
import {
  vfsStats,
  formatSize,
  emptyTrash,
  subscribeTrash,
  getQuotaBytes,
  setQuotaBytes,
  subscribeFs,
  type VFSStats,
} from "../vfs/vfs";
import { notify } from "../stores/notification-store";
import { profile, updateProfile, resetProfile } from "../stores/profile-store";
import { recentApps, clearRecents } from "../stores/recents-store";
import { listManifests, manifestsVersion, uninstallManifest } from "../core/app-manifest";
import {
  clearAppPermissions,
  listAppPermissions,
  permissionLabel,
  permissionsVersion,
  setPermissionState,
  type PermissionDecision,
} from "../core/permissions";
import { listShortcuts, resetShortcut } from "../core/shortcut-manager";
import { openWindow } from "../stores/window-store";
import {
  pendingSettingsPage,
  consumePendingSettingsPage,
} from "../core/settings-nav";
import {
  soundEnabled,
  soundVolume,
  setSoundEnabled,
  setSoundVolume,
  playSound,
  type SoundName,
} from "../core/sound-manager";

type SettingsPage =
  | "appearance"
  | "wallpaper"
  | "sound"
  | "account"
  | "apps"
  | "keyboard"
  | "storage"
  | "backend"
  | "about";

const QUOTA_PRESETS_BYTES = [
  { label: "1 GB", bytes: 1 * 1024 * 1024 * 1024 },
  { label: "2 GB", bytes: 2 * 1024 * 1024 * 1024 },
  { label: "5 GB", bytes: 5 * 1024 * 1024 * 1024 },
  { label: "10 GB", bytes: 10 * 1024 * 1024 * 1024 },
  { label: "20 GB", bytes: 20 * 1024 * 1024 * 1024 },
  { label: "50 GB", bytes: 50 * 1024 * 1024 * 1024 },
];

const accentColors = [
  { name: "Indigo", value: "#6366f1" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Green", value: "#22c55e" },
  { name: "Yellow", value: "#eab308" },
  { name: "Orange", value: "#f97316" },
  { name: "Red", value: "#ef4444" },
  { name: "Pink", value: "#ec4899" },
  { name: "Purple", value: "#a855f7" },
];

const wallpapers = [
  { name: "Default", value: "", preview: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" },
  { name: "Sunset", value: "linear-gradient(135deg, #ff6b6b 0%, #feca57 50%, #ff9ff3 100%)", preview: "linear-gradient(135deg, #ff6b6b, #feca57, #ff9ff3)" },
  { name: "Ocean", value: "linear-gradient(135deg, #0c2461 0%, #1e3799 40%, #0a3d62 100%)", preview: "linear-gradient(135deg, #0c2461, #1e3799, #0a3d62)" },
  { name: "Forest", value: "linear-gradient(135deg, #0a3d0a 0%, #2d6a2d 50%, #1a4a1a 100%)", preview: "linear-gradient(135deg, #0a3d0a, #2d6a2d, #1a4a1a)" },
  { name: "Aurora", value: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)", preview: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" },
  { name: "Cherry", value: "linear-gradient(135deg, #3c1053 0%, #ad5389 100%)", preview: "linear-gradient(135deg, #3c1053, #ad5389)" },
  { name: "Arctic", value: "linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)", preview: "linear-gradient(135deg, #e0eafc, #cfdef3)" },
  { name: "Neon", value: "linear-gradient(135deg, #0f0f0f 0%, #1a0033 50%, #0f0f0f 100%)", preview: "linear-gradient(135deg, #0f0f0f, #1a0033, #0f0f0f)" },
  { name: "Warm", value: "linear-gradient(135deg, #2c1810 0%, #4a2c1a 50%, #3d1f10 100%)", preview: "linear-gradient(135deg, #2c1810, #4a2c1a, #3d1f10)" },
  { name: "Sky", value: "linear-gradient(180deg, #87ceeb 0%, #4682b4 50%, #1e3a5f 100%)", preview: "linear-gradient(180deg, #87ceeb, #4682b4, #1e3a5f)" },
  { name: "Midnight", value: "linear-gradient(135deg, #020024 0%, #090979 50%, #00d4ff 100%)", preview: "linear-gradient(135deg, #020024, #090979, #00d4ff)" },
  { name: "Rose", value: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)", preview: "linear-gradient(135deg, #ffecd2, #fcb69f)" },
];

const ThemePicker: Component = () => {
  const isActive = (t: CloudOSTheme) => theme() === t.id;
  const swatchBg = (t: CloudOSTheme) => t.preview ?? t.colors["--color-os-bg"] ?? "#000";

  return (
    <div class="mb-6">
      <label class="text-os-text-muted mb-2 block">Theme</label>
      <div class="grid grid-cols-3 gap-2">
        <For each={availableThemes()}>
          {(t) => (
            <div
              class="relative flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors cursor-pointer"
              classList={{
                "border-os-accent bg-os-accent/10": isActive(t),
                "border-os-border hover:border-os-accent/50": !isActive(t),
              }}
              onClick={() => setActiveTheme(t.id)}
              title={`${t.name} (${t.kind})`}
            >
              <div
                class="w-full h-12 rounded border border-os-border"
                style={{ background: swatchBg(t) }}
              />
              <span class="text-[11px] text-center truncate w-full">{t.name}</span>
              <Show when={t.kind === "custom"}>
                <button
                  class="absolute top-1 right-1 w-5 h-5 rounded-full bg-os-danger/80 text-white text-[10px] flex items-center justify-center hover:bg-os-danger transition-colors"
                  title="Delete custom theme"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete theme "${t.name}"?`)) {
                      removeCustomTheme(t.id);
                      notify({
                        title: "Theme removed",
                        message: `Deleted custom theme "${t.name}"`,
                        type: "info",
                        icon: "🎨",
                      });
                    }
                  }}
                >
                  ×
                </button>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

const ThemeImportExport: Component = () => {
  let fileInput: HTMLInputElement | undefined;

  const handleImport = async (file: File) => {
    const text = await file.text();
    const r = importThemeFromJSON(text);
    if (!r.ok) {
      notify({
        title: "Theme import failed",
        message: r.reason ?? "Unknown error",
        type: "error",
        icon: "🎨",
      });
      return;
    }
    if (r.id) setActiveTheme(r.id);
    notify({
      title: "Theme imported",
      message: r.id ? `Activated "${r.id}"` : "Theme added to picker",
      type: "success",
      icon: "🎨",
    });
  };

  const handleExport = async () => {
    const json = exportThemeToJSON(theme());
    if (!json) return;
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cloudos-theme-${theme()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify({
      title: "Theme exported",
      message: `Downloaded "${theme()}" as JSON`,
      type: "success",
      icon: "📥",
    });
  };

  return (
    <div class="mb-6">
      <label class="text-os-text-muted mb-2 block">Theme JSON</label>
      <div class="flex gap-2">
        <button
          class="flex-1 px-3 py-2 rounded-md bg-os-surface border border-os-border hover:bg-os-surface-hover transition-colors text-xs"
          onClick={() => fileInput?.click()}
        >
          📤 Import theme…
        </button>
        <button
          class="flex-1 px-3 py-2 rounded-md bg-os-surface border border-os-border hover:bg-os-surface-hover transition-colors text-xs"
          onClick={handleExport}
        >
          📥 Export current
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          class="hidden"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f) void handleImport(f);
            e.currentTarget.value = "";
          }}
        />
      </div>
      <p class="text-[10px] text-os-text-muted mt-2 leading-relaxed">
        Themes are CloudOS JSON: <code>id</code>, <code>name</code>, <code>base</code>, <code>wallpaper</code>, and a <code>colors</code> map of CSS variables. Built-in ids (<code>dark</code>, <code>light</code>, <code>solarized-dark</code>, <code>solarized-light</code>, <code>nord</code>) are reserved.
      </p>
    </div>
  );
};

const Settings: Component<{ windowId: string }> = () => {
  const [page, setPage] = createSignal<SettingsPage>("appearance");
  const [stats, setStats] = createSignal<VFSStats>(vfsStats());
  const [quota, setQuotaSignal] = createSignal<number>(getQuotaBytes());

  const refreshStats = () => {
    setStats(vfsStats());
    setQuotaSignal(getQuotaBytes());
  };

  onMount(() => {
    refreshStats();
    // If Spotlight (or anything else) staged a page jump before the
    // Settings window opened, pick it up now.
    const initialJump = consumePendingSettingsPage();
    if (initialJump) setPage(initialJump);
    const unsubTrash = subscribeTrash(refreshStats);
    const unsubFs = subscribeFs(refreshStats);
    onCleanup(() => {
      unsubTrash();
      unsubFs();
    });
  });

  // Existing Settings windows also listen for jumps so that "Jump to
  // Settings → Sound" focuses + navigates an already-open window.
  createMemo(() => {
    const jump = pendingSettingsPage();
    if (jump) {
      setPage(jump);
      consumePendingSettingsPage();
    }
  });

  const sidebarItems: { id: SettingsPage; label: string; icon: string }[] = [
    { id: "appearance", label: "Appearance", icon: "🎨" },
    { id: "wallpaper", label: "Wallpaper", icon: "🖼️" },
    { id: "sound", label: "Sound", icon: "🔊" },
    { id: "account", label: "Account", icon: "👤" },
    { id: "apps", label: "Apps", icon: "📦" },
    { id: "keyboard", label: "Keyboard", icon: "⌨️" },
    { id: "storage", label: "Storage", icon: "💾" },
    { id: "backend", label: "Backend", icon: "🔗" },
    { id: "about", label: "About", icon: "ℹ️" },
  ];

  const soundPreviews: { name: SoundName; label: string }[] = [
    { name: "open", label: "Window Open" },
    { name: "close", label: "Window Close" },
    { name: "minimize", label: "Minimize" },
    { name: "maximize", label: "Maximize" },
    { name: "notify", label: "Notification" },
    { name: "success", label: "Success" },
    { name: "warning", label: "Warning" },
    { name: "error", label: "Error" },
    { name: "lock", label: "Lock" },
    { name: "unlock", label: "Unlock" },
    { name: "click", label: "Click" },
    { name: "focus", label: "Focus" },
  ];

  const usedBytes = () => stats().totalBytes + stats().trashBytes;
  const usedPct = () => Math.min(100, (usedBytes() / quota()) * 100);

  const handleQuotaChange = (bytes: number) => {
    if (bytes < usedBytes()) {
      notify({
        title: "Quota too small",
        message: `Used ${formatSize(usedBytes())}; raise a few GB or empty trash first.`,
        type: "warning",
        icon: "\uD83D\uDCBE",
      });
      return;
    }
    setQuotaBytes(bytes);
    setQuotaSignal(bytes);
    notify({
      title: "Storage quota updated",
      message: `Now ${formatSize(bytes)}`,
      type: "success",
      icon: "\uD83D\uDCBE",
    });
  };

  return (
    <div class="flex h-full text-xs">
      {/* Sidebar */}
      <div class="w-36 border-r border-os-border p-2 flex-shrink-0">
        <p class="text-[10px] text-os-text-muted uppercase tracking-wider mb-2 px-2">Settings</p>
        <For each={sidebarItems}>
          {(item) => (
            <button
              class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-left"
              classList={{
                "bg-os-accent/20 text-os-accent-hover": page() === item.id,
                "hover:bg-os-surface-hover text-os-text": page() !== item.id,
              }}
              onClick={() => setPage(item.id)}
            >
              <span class="text-sm">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          )}
        </For>
      </div>

      {/* Content */}
      <div class="flex-1 p-4 overflow-y-auto">
        <Show when={page() === "appearance"}>
          <h2 class="text-sm font-semibold mb-4">Appearance</h2>

          {/* Theme picker — built-in + custom (JSON-imported) */}
          <ThemePicker />

          {/* Theme JSON import/export */}
          <ThemeImportExport />

          {/* Accent Color */}
          <div class="mb-6">
            <label class="text-os-text-muted mb-2 block">Accent Color</label>
            <div class="flex gap-2 flex-wrap">
              <For each={accentColors}>
                {(color) => (
                  <button
                    class="w-7 h-7 rounded-full border-2 transition-all"
                    classList={{
                      "border-white scale-110": accentColor() === color.value,
                      "border-transparent hover:scale-105": accentColor() !== color.value,
                    }}
                    style={{ background: color.value }}
                    onClick={() => setAccentColor(color.value)}
                    title={color.name}
                  />
                )}
              </For>
            </div>
          </div>
        </Show>

        <Show when={page() === "wallpaper"}>
          <h2 class="text-sm font-semibold mb-4">Wallpaper</h2>
          <div class="grid grid-cols-3 gap-3">
            <For each={wallpapers}>
              {(wp) => (
                <button
                  class="relative rounded-xl overflow-hidden border-2 transition-all h-20 group"
                  classList={{
                    "border-os-accent shadow-lg shadow-os-accent/20": wallpaper() === wp.value,
                    "border-os-border hover:border-os-accent/50": wallpaper() !== wp.value,
                  }}
                  onClick={() => setWallpaper(wp.value)}
                >
                  <div class="absolute inset-0" style={{ background: wp.preview }} />
                  <div class="absolute inset-x-0 bottom-0 bg-black/50 px-2 py-1 text-[10px] text-white/80 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {wp.name}
                  </div>
                  <Show when={wallpaper() === wp.value}>
                    <div class="absolute top-1 right-1 w-4 h-4 rounded-full bg-os-accent flex items-center justify-center text-white text-[8px]">
                      ✓
                    </div>
                  </Show>
                </button>
              )}
            </For>
          </div>
        </Show>

        <Show when={page() === "sound"}>
          <h2 class="text-sm font-semibold mb-4">Sound</h2>

          {/* Master toggle */}
          <div class="rounded-lg border border-os-border p-3 mb-4 flex items-center justify-between">
            <div>
              <div>System sounds</div>
              <div class="text-[10px] text-os-text-muted">Play sound effects for windows, notifications, and key events.</div>
            </div>
            <button
              role="switch"
              aria-checked={soundEnabled()}
              onClick={() => {
                const v = !soundEnabled();
                setSoundEnabled(v);
                if (v) playSound("notify");
              }}
              class="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
              classList={{
                "bg-os-accent": soundEnabled(),
                "bg-os-surface": !soundEnabled(),
              }}
            >
              <span
                class="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                classList={{
                  "left-0.5": !soundEnabled(),
                  "left-[calc(100%-1.125rem)]": soundEnabled(),
                }}
              />
            </button>
          </div>

          {/* Volume slider */}
          <div class="rounded-lg border border-os-border p-3 mb-4">
            <div class="flex items-center justify-between mb-2">
              <span>Volume</span>
              <span class="text-os-text-muted text-[10px]">{Math.round(soundVolume() * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(soundVolume() * 100)}
              disabled={!soundEnabled()}
              onInput={(e) => setSoundVolume(parseInt(e.currentTarget.value, 10) / 100)}
              onChange={() => playSound("notify")}
              class="w-full accent-os-accent disabled:opacity-30"
            />
          </div>

          {/* Preview */}
          <div class="rounded-lg border border-os-border p-3">
            <div class="text-os-text-muted mb-2 text-[10px] uppercase tracking-wider">Preview</div>
            <div class="grid grid-cols-2 gap-2">
              <For each={soundPreviews}>
                {(s) => (
                  <button
                    class="flex items-center justify-between gap-2 px-3 py-1.5 rounded border border-os-border hover:bg-os-surface-hover transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    disabled={!soundEnabled()}
                    onClick={() => playSound(s.name)}
                  >
                    <span>{s.label}</span>
                    <span class="text-os-text-muted text-[10px]">▶</span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        <Show when={page() === "account"}>
          <AccountPage />
        </Show>

        <Show when={page() === "apps"}>
          <AppsPage />
        </Show>

        <Show when={page() === "keyboard"}>
          <KeyboardPage />
        </Show>

        <Show when={page() === "storage"}>
          <h2 class="text-sm font-semibold mb-4">Storage</h2>

          {/* Quota gauge */}
          <div class="mb-6">
            <div class="flex items-end justify-between mb-2">
              <div>
                <div class="text-os-text">{formatSize(usedBytes())} <span class="text-os-text-muted">used</span></div>
                <div class="text-[10px] text-os-text-muted">of {formatSize(quota())} quota</div>
              </div>
              <div class="text-[10px] text-os-text-muted">{usedPct().toFixed(2)}%</div>
            </div>
            <div class="h-2 rounded-full bg-os-surface overflow-hidden">
              <div
                class="h-full transition-all"
                classList={{
                  "bg-os-accent": usedPct() < 75,
                  "bg-os-warning": usedPct() >= 75 && usedPct() < 90,
                  "bg-os-danger": usedPct() >= 90,
                }}
                style={{ width: `${Math.max(0.5, usedPct())}%` }}
              />
            </div>
            <Show when={usedPct() >= 75}>
              <p class="text-[10px] text-os-warning mt-2">
                You're using a lot of storage. Consider emptying trash or removing unused files.
              </p>
            </Show>
          </div>

          {/* Quota selector */}
          <div class="rounded-lg border border-os-border p-3 mb-6">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-os-text-muted">Quota</h3>
              <span class="text-[10px] text-os-text-muted">Hard cap on writes — file create / save / drop</span>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <For each={QUOTA_PRESETS_BYTES}>
                {(preset) => (
                  <button
                    class="px-2.5 py-1 rounded text-[11px] border transition-colors"
                    classList={{
                      "border-os-accent bg-os-accent/10 text-os-accent": quota() === preset.bytes,
                      "border-os-border hover:border-os-accent/50": quota() !== preset.bytes,
                    }}
                    onClick={() => handleQuotaChange(preset.bytes)}
                    title={`Set quota to ${preset.label}`}
                  >
                    {preset.label}
                  </button>
                )}
              </For>
            </div>
            <p class="text-[10px] text-os-text-muted mt-2 leading-relaxed">
              When usage would exceed the cap, <code>writeFile</code> / <code>createFile</code> throw <code>VFSQuotaExceededError</code> and the calling app shows a notification instead of silently dropping the bytes. Trash counts towards the quota — empty it to reclaim space.
            </p>
          </div>

          {/* Top folder usage */}
          <div class="mb-6">
            <h3 class="text-os-text-muted mb-2">By folder</h3>
            <Show when={stats().byFolder.length > 0} fallback={
              <p class="text-[10px] text-os-text-muted">No files yet.</p>
            }>
              <div class="space-y-1.5">
                <For each={stats().byFolder}>
                  {(f) => (
                    <div class="flex items-center gap-2">
                      <span class="w-32 truncate">{f.path}</span>
                      <div class="flex-1 h-1.5 rounded-full bg-os-surface overflow-hidden">
                        <div
                          class="h-full bg-os-accent"
                          style={{ width: `${stats().totalBytes > 0 ? (f.bytes / stats().totalBytes) * 100 : 0}%` }}
                        />
                      </div>
                      <span class="w-20 text-right text-os-text-muted">{formatSize(f.bytes)}</span>
                      <span class="w-10 text-right text-[10px] text-os-text-muted">{f.count}</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* Counts */}
          <div class="grid grid-cols-3 gap-2 mb-6">
            <div class="rounded-lg border border-os-border p-3">
              <div class="text-[10px] text-os-text-muted">Files</div>
              <div class="text-base font-semibold mt-1">{stats().fileCount}</div>
            </div>
            <div class="rounded-lg border border-os-border p-3">
              <div class="text-[10px] text-os-text-muted">Folders</div>
              <div class="text-base font-semibold mt-1">{stats().dirCount}</div>
            </div>
            <div class="rounded-lg border border-os-border p-3">
              <div class="text-[10px] text-os-text-muted">In Trash</div>
              <div class="text-base font-semibold mt-1">{stats().trashCount}</div>
            </div>
          </div>

          {/* Trash actions */}
          <div class="rounded-lg border border-os-border p-3 flex items-center justify-between">
            <div>
              <div>Trash uses {formatSize(stats().trashBytes)}</div>
              <div class="text-[10px] text-os-text-muted">Items removed from Trash cannot be restored.</div>
            </div>
            <button
              class="px-3 py-1.5 rounded bg-os-danger/20 text-os-danger hover:bg-os-danger/30 transition-colors disabled:opacity-30 disabled:hover:bg-os-danger/20"
              disabled={stats().trashCount === 0}
              onClick={() => {
                const count = stats().trashCount;
                emptyTrash();
                refreshStats();
                notify({ title: "Trash Emptied", message: `${count} item(s) permanently deleted`, type: "info", icon: "🗑️" });
              }}
            >
              Empty Trash
            </button>
          </div>
        </Show>

        <Show when={page() === "backend"}>
          <BackendPanel />
        </Show>

        <Show when={page() === "about"}>
          <h2 class="text-sm font-semibold mb-4">About CloudOS</h2>
          <div class="space-y-3">
            <div class="flex justify-between py-2 border-b border-os-border">
              <span class="text-os-text-muted">Version</span>
              <span>0.1.0</span>
            </div>
            <div class="flex justify-between py-2 border-b border-os-border">
              <span class="text-os-text-muted">Framework</span>
              <span>SolidJS</span>
            </div>
            <div class="flex justify-between py-2 border-b border-os-border">
              <span class="text-os-text-muted">Backend</span>
              <span>Go + Fiber</span>
            </div>
            <div class="flex justify-between py-2 border-b border-os-border">
              <span class="text-os-text-muted">Build</span>
              <span>Vite + Turborepo</span>
            </div>
            <div class="flex justify-between py-2 border-b border-os-border">
              <span class="text-os-text-muted">License</span>
              <span>AGPL-3.0</span>
            </div>
            <p class="text-os-text-muted mt-4">
              CloudOS is an open-source browser-based operating system.
            </p>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default Settings;

// ---------------------------------------------------------------------------
// Account: edit displayName / email / avatar / bio (persisted to localStorage)
// ---------------------------------------------------------------------------
const AccountPage: Component = () => {
  const avatarOptions = ["🙂", "😎", "🐶", "🐱", "🦊", "🐼", "🦄", "🐙", "🤖", "👨‍💻", "👩‍💻", "🦉"];
  return (
    <div class="space-y-4">
      <h2 class="text-sm font-semibold">Account</h2>
      <p class="text-os-text-muted">
        These details are stored locally in your browser. CloudOS doesn't talk to a remote server
        for the local desktop unless you switch the storage backend to Remote.
      </p>

      <div class="rounded-lg border border-os-border p-4 flex items-center gap-4">
        <div class="w-14 h-14 rounded-full bg-os-accent/20 flex items-center justify-center text-2xl">
          {profile.avatar}
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-medium truncate">{profile.displayName || "Local User"}</div>
          <div class="text-[11px] text-os-text-muted truncate">
            {profile.email || "No email set"}
          </div>
        </div>
      </div>

      <label class="block">
        <span class="block text-os-text-muted mb-1">Display name</span>
        <input
          type="text"
          class="w-full px-3 py-1.5 rounded-md bg-os-surface border border-os-border focus:outline-none focus:border-os-accent"
          value={profile.displayName}
          onInput={(e) => updateProfile({ displayName: e.currentTarget.value })}
        />
      </label>

      <label class="block">
        <span class="block text-os-text-muted mb-1">Email</span>
        <input
          type="email"
          class="w-full px-3 py-1.5 rounded-md bg-os-surface border border-os-border focus:outline-none focus:border-os-accent"
          placeholder="you@example.com"
          value={profile.email}
          onInput={(e) => updateProfile({ email: e.currentTarget.value })}
        />
      </label>

      <label class="block">
        <span class="block text-os-text-muted mb-1">Bio</span>
        <textarea
          rows="3"
          class="w-full px-3 py-1.5 rounded-md bg-os-surface border border-os-border focus:outline-none focus:border-os-accent resize-none"
          placeholder="A short bio..."
          value={profile.bio}
          onInput={(e) => updateProfile({ bio: e.currentTarget.value })}
        />
      </label>

      <div>
        <span class="block text-os-text-muted mb-1.5">Avatar</span>
        <div class="flex gap-1.5 flex-wrap">
          <For each={avatarOptions}>
            {(emoji) => (
              <button
                class="w-9 h-9 rounded-full text-xl flex items-center justify-center transition-all"
                classList={{
                  "bg-os-accent/30 ring-2 ring-os-accent": profile.avatar === emoji,
                  "bg-os-surface hover:bg-os-surface-hover": profile.avatar !== emoji,
                }}
                onClick={() => updateProfile({ avatar: emoji })}
              >
                {emoji}
              </button>
            )}
          </For>
        </div>
      </div>

      <div class="pt-2">
        <button
          class="text-os-danger hover:underline text-[11px]"
          onClick={() => {
            resetProfile();
            notify({ title: "Profile reset", message: "Account details cleared", type: "info", icon: "👤" });
          }}
        >
          Reset profile to defaults
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Apps → Permissions row. Lists all permissions a single manifest declares
// and lets the user toggle Allow / Ask / Deny per perm.
// ---------------------------------------------------------------------------
const PermissionAppRow: Component<{ appId: string; name: string; icon: string }> = (props) => {
  // Subscribe to the permissions signal so we re-render on grant/deny.
  const perms = createMemo(() => {
    void permissionsVersion();
    return listAppPermissions(props.appId);
  });

  return (
    <div class="rounded-lg border border-os-border p-3">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-lg">{props.icon}</span>
        <span class="font-medium text-[13px]">{props.name}</span>
      </div>
      <Show
        when={perms().length > 0}
        fallback={<p class="text-[11px] text-os-text-muted">Declares no permissions.</p>}
      >
        <div class="space-y-1.5">
          <For each={perms()}>
            {(item) => (
              <div class="flex items-center justify-between gap-2">
                <div class="text-[11px] flex-1 min-w-0">
                  <div class="text-os-text truncate">{permissionLabel(item.perm)}</div>
                  <code class="text-[9px] text-os-text-muted">{item.perm}</code>
                </div>
                <div class="flex gap-1 flex-shrink-0">
                  <PermStateButton
                    label="Allow"
                    active={item.state === "granted"}
                    color="emerald"
                    onClick={() => setPermissionState(props.appId, item.perm, "granted")}
                  />
                  <PermStateButton
                    label="Ask"
                    active={item.state === "ask"}
                    color="zinc"
                    onClick={() => setPermissionState(props.appId, item.perm, "ask")}
                  />
                  <PermStateButton
                    label="Deny"
                    active={item.state === "denied"}
                    color="rose"
                    onClick={() => setPermissionState(props.appId, item.perm, "denied")}
                  />
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

const PermStateButton: Component<{
  label: string;
  active: boolean;
  color: "emerald" | "zinc" | "rose";
  onClick: () => void;
}> = (props) => {
  // Tailwind needs literal class strings — build via switch so the JIT
  // sees them.
  const cls = () => {
    if (!props.active) return "border-os-border text-os-text-muted hover:bg-os-surface-hover";
    switch (props.color) {
      case "emerald": return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
      case "zinc":    return "border-zinc-500/40 bg-zinc-500/15 text-zinc-200";
      case "rose":    return "border-rose-500/40 bg-rose-500/15 text-rose-300";
    }
  };
  return (
    <button
      type="button"
      class={`px-2 py-0.5 rounded text-[10px] border transition-colors ${cls()}`}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  );
};

// Silence the unused-type warning on PermissionDecision when we don't
// reference it directly. The import is kept so `setPermissionState`'s
// third argument typing flows through.
const _decisionTypeBrand: PermissionDecision = "ask";
void _decisionTypeBrand;

// ---------------------------------------------------------------------------
// Apps: list installed manifest apps + launch / uninstall, manage recents
// ---------------------------------------------------------------------------
const AppsPage: Component = () => {
  const manifests = createMemo(() => {
    void manifestsVersion();
    return listManifests();
  });

  const handleUninstall = (id: string, name: string) => {
    if (!window.confirm(`Uninstall ${name}? This removes the manifest entry.`)) return;
    if (uninstallManifest(id)) {
      // Forget any granted/denied perms for the uninstalled app — otherwise
      // a future install of the same id would silently inherit them.
      clearAppPermissions(id);
      notify({ title: "Uninstalled", message: name, type: "info", icon: "📦" });
    } else {
      notify({ title: "Uninstall failed", message: "Manifest not found", type: "warning", icon: "⚠️" });
    }
  };

  const launch = (id: string, name: string, icon: string) => {
    openWindow({ appId: id, title: name, icon, width: 720, height: 480 });
  };

  return (
    <div class="space-y-4">
      <h2 class="text-sm font-semibold">Apps</h2>
      <p class="text-os-text-muted">Manage installed manifest apps and your recent-app history.</p>

      <div>
        <h3 class="text-xs font-semibold mb-2">Installed apps</h3>
        <Show when={manifests().length > 0} fallback={
          <div class="rounded-lg border border-dashed border-os-border p-4 text-center text-[11px] text-os-text-muted">
            No manifest apps installed yet. Drop a JSON manifest into App Store, or write one yourself
            (see docs/APP_DEV.md).
          </div>
        }>
          <div class="grid gap-2">
            <For each={manifests()}>
              {(m) => (
                <div class="flex items-center gap-3 p-3 rounded-lg border border-os-border">
                  <span class="text-2xl flex-shrink-0">{m.icon}</span>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium truncate">{m.name}</div>
                    <div class="text-[10px] text-os-text-muted truncate">
                      {m.id} · v{m.version} · {m.category ?? "Apps"}
                    </div>
                  </div>
                  <button
                    class="px-2 py-1 rounded text-[11px] hover:bg-os-surface-hover transition-colors"
                    onClick={() => launch(m.id, m.name, m.icon)}
                  >
                    Launch
                  </button>
                  <button
                    class="px-2 py-1 rounded text-[11px] text-os-danger hover:bg-os-danger/20 transition-colors"
                    onClick={() => handleUninstall(m.id, m.name)}
                  >
                    Uninstall
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      <div class="pt-3 border-t border-os-border">
        <h3 class="text-xs font-semibold mb-2">Permissions</h3>
        <p class="text-[11px] text-os-text-muted mb-2">
          Each manifest declares the permissions it can request. Apps prompt you the first
          time they actually use one — your decision is remembered here. Reset to "Ask" to
          re-prompt on next use.
        </p>
        <Show when={manifests().length > 0} fallback={
          <p class="text-[11px] text-os-text-muted">No installed apps yet.</p>
        }>
          <div class="grid gap-2">
            <For each={manifests()}>
              {(m) => <PermissionAppRow appId={m.id} name={m.name} icon={m.icon} />}
            </For>
          </div>
        </Show>
      </div>

      <div class="pt-3 border-t border-os-border">
        <h3 class="text-xs font-semibold mb-2">Recent apps</h3>
        <Show when={recentApps().length > 0} fallback={
          <p class="text-[11px] text-os-text-muted">No recent launches yet.</p>
        }>
          <div class="text-[11px] text-os-text-muted space-y-1 mb-2">
            <For each={recentApps()}>{(id) => <div>{id}</div>}</For>
          </div>
          <button
            class="px-3 py-1 rounded-md bg-os-surface border border-os-border hover:bg-os-surface-hover text-[11px]"
            onClick={() => {
              clearRecents();
              notify({ title: "Recents cleared", type: "info", icon: "📦" });
            }}
          >
            Clear recents
          </button>
        </Show>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Keyboard: list shortcuts (read-only summary; full editor is in Shortcuts app)
// ---------------------------------------------------------------------------
const KeyboardPage: Component = () => {
  const shortcuts = () => listShortcuts();

  const formatBinding = (b: { key: string; ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean }) => {
    const parts: string[] = [];
    if (b.ctrl) parts.push("Ctrl");
    if (b.alt) parts.push("Alt");
    if (b.shift) parts.push("Shift");
    if (b.meta) parts.push("Meta");
    if (b.key === " ") parts.push("Space"); else parts.push(b.key.toUpperCase());
    return parts.join(" + ");
  };

  return (
    <div class="space-y-4">
      <h2 class="text-sm font-semibold">Keyboard</h2>
      <p class="text-os-text-muted">
        Quick overview of registered shortcuts. Use the Shortcuts app for full editing (record new
        binding, conflict detection, reset all).
      </p>
      <button
        class="px-3 py-1.5 rounded-md bg-os-accent/20 hover:bg-os-accent/30 text-os-accent-hover text-[11px] transition-colors"
        onClick={() => openWindow({ appId: "com.cloudos.shortcuts", title: "Shortcuts", icon: "⌨️", width: 700, height: 520 })}
      >
        Open Shortcuts app
      </button>

      <div class="rounded-lg border border-os-border divide-y divide-os-border overflow-hidden">
        <For each={shortcuts()}>
          {(s) => (
            <div class="flex items-center gap-3 px-3 py-2 text-[11px]">
              <span class="flex-1 truncate">{s.description}</span>
              <kbd class="px-2 py-0.5 rounded bg-os-surface border border-os-border font-mono">
                {formatBinding(s.current)}
              </kbd>
              <Show when={s.isCustom}>
                <button
                  class="text-[10px] text-os-text-muted hover:text-os-text"
                  title="Reset to default"
                  onClick={() => {
                    resetShortcut(s.id);
                    notify({ title: "Shortcut reset", message: s.description, type: "info", icon: "⌨️" });
                  }}
                >
                  ↻ reset
                </button>
              </Show>
              <Show when={s.locked}>
                <span class="text-[10px] text-os-text-muted">locked</span>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

const BackendPanel: Component = () => {
  const [backends, setBackends] = createSignal<{ id: string; displayName: string; available: boolean }[]>([]);
  const [remoteCfg, setRemoteCfg] = createSignal<{ baseUrl: string; token: string }>({ baseUrl: "/api/v1", token: "" });

  const refresh = async () => {
    const { adapterStatuses } = await import("../vfs/sync");
    const { loadRemoteConfig } = await import("../vfs/adapters/remote");
    const list = await adapterStatuses();
    setBackends(list.map((b) => ({ id: b.id, displayName: b.displayName, available: b.available })));
    setRemoteCfg(loadRemoteConfig());
  };

  onMount(() => {
    void refresh();
  });

  const switchTo = async (id: "memory" | "opfs" | "remote") => {
    const { setBackend } = await import("../vfs/sync");
    try {
      await setBackend(id);
      notify({ title: "Storage backend", message: `Switched to ${id}`, type: "success", icon: "💾" });
      void refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      notify({ title: "Backend switch failed", message: msg, type: "error", icon: "💾" });
    }
  };

  const syncNowClick = async () => {
    const { syncNow } = await import("../vfs/sync");
    await syncNow();
    notify({ title: "Sync", message: "Pushed snapshot to backend", type: "success", icon: "💾" });
  };

  const pullClick = async () => {
    const { pullFromBackend } = await import("../vfs/sync");
    await pullFromBackend();
    notify({ title: "Sync", message: "Pulled snapshot from backend", type: "success", icon: "💾" });
  };

  const saveRemote = async () => {
    const { saveRemoteConfig } = await import("../vfs/adapters/remote");
    saveRemoteConfig(remoteCfg());
    notify({ title: "Remote config", message: "Saved", type: "info", icon: "🔗" });
    void refresh();
  };

  return (
    <div class="space-y-4 text-xs">
      <h2 class="text-sm font-semibold">Storage Backend</h2>
      <p class="text-os-text-muted">
        Choose where to persist your virtual file system. The default is in-memory + browser
        localStorage. Switch to OPFS for browser-native persistent files, or Remote to sync against
        a CloudOS API server.
      </p>

      <div class="grid gap-2">
        <For each={backends()}>
          {(b) => (
            <div
              class="flex items-center justify-between p-3 rounded-lg border"
              classList={{
                "border-os-accent bg-os-accent/10": b.available,
                "border-os-border opacity-60": !b.available,
              }}
            >
              <div>
                <div class="font-medium">{b.displayName}</div>
                <div class="text-[10px] text-os-text-muted">
                  {b.available ? "Available" : "Unavailable in this environment"}
                </div>
              </div>
              <button
                class="px-3 py-1 rounded bg-os-accent text-white disabled:opacity-30"
                disabled={!b.available}
                onClick={() => void switchTo(b.id as "memory" | "opfs" | "remote")}
              >
                Use
              </button>
            </div>
          )}
        </For>
      </div>

      <h3 class="text-xs font-semibold mt-4">Remote API config</h3>
      <label class="block">
        <span class="block text-os-text-muted mb-1">Base URL</span>
        <input
          type="text"
          class="w-full px-3 py-1.5 rounded bg-os-surface border border-os-border focus:outline-none focus:border-os-accent"
          value={remoteCfg().baseUrl}
          onInput={(e) => setRemoteCfg({ ...remoteCfg(), baseUrl: e.currentTarget.value })}
        />
      </label>
      <label class="block">
        <span class="block text-os-text-muted mb-1">Auth token (optional)</span>
        <input
          type="password"
          class="w-full px-3 py-1.5 rounded bg-os-surface border border-os-border focus:outline-none focus:border-os-accent"
          value={remoteCfg().token}
          onInput={(e) => setRemoteCfg({ ...remoteCfg(), token: e.currentTarget.value })}
        />
      </label>
      <button
        class="px-3 py-1.5 rounded bg-os-accent text-white"
        onClick={() => void saveRemote()}
      >
        Save remote config
      </button>

      <div class="flex gap-2 pt-3 border-t border-os-border">
        <button
          class="px-3 py-1.5 rounded bg-os-surface border border-os-border hover:bg-os-surface-hover"
          onClick={() => void syncNowClick()}
        >
          Push snapshot now
        </button>
        <button
          class="px-3 py-1.5 rounded bg-os-surface border border-os-border hover:bg-os-surface-hover"
          onClick={() => void pullClick()}
        >
          Pull snapshot from backend
        </button>
      </div>
    </div>
  );
};
