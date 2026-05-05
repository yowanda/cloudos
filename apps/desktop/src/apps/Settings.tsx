import { Component, For, createSignal, Show, onCleanup, onMount } from "solid-js";
import { theme, setTheme, accentColor, setAccentColor, wallpaper, setWallpaper } from "../stores/theme-store";
import { vfsStats, formatSize, emptyTrash, subscribeTrash, type VFSStats } from "../vfs/vfs";
import { notify } from "../stores/notification-store";

type SettingsPage = "appearance" | "wallpaper" | "storage" | "about";

const STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB demo quota

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

const Settings: Component<{ windowId: string }> = () => {
  const [page, setPage] = createSignal<SettingsPage>("appearance");
  const [stats, setStats] = createSignal<VFSStats>(vfsStats());

  const refreshStats = () => setStats(vfsStats());

  onMount(() => {
    refreshStats();
    const unsub = subscribeTrash(refreshStats);
    onCleanup(unsub);
  });

  const sidebarItems: { id: SettingsPage; label: string; icon: string }[] = [
    { id: "appearance", label: "Appearance", icon: "🎨" },
    { id: "wallpaper", label: "Wallpaper", icon: "🖼️" },
    { id: "storage", label: "Storage", icon: "💾" },
    { id: "about", label: "About", icon: "ℹ️" },
  ];

  const usedBytes = () => stats().totalBytes + stats().trashBytes;
  const usedPct = () => Math.min(100, (usedBytes() / STORAGE_QUOTA_BYTES) * 100);

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

          {/* Theme */}
          <div class="mb-6">
            <label class="text-os-text-muted mb-2 block">Theme</label>
            <div class="flex gap-2">
              <button
                class="flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors"
                classList={{
                  "border-os-accent bg-os-accent/10": theme() === "dark",
                  "border-os-border hover:border-os-accent/50": theme() !== "dark",
                }}
                onClick={() => setTheme("dark")}
              >
                <div class="w-full h-12 rounded bg-[#1a1a2e] border border-[#333]" />
                <span>Dark</span>
              </button>
              <button
                class="flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors"
                classList={{
                  "border-os-accent bg-os-accent/10": theme() === "light",
                  "border-os-border hover:border-os-accent/50": theme() !== "light",
                }}
                onClick={() => setTheme("light")}
              >
                <div class="w-full h-12 rounded bg-[#f0f4f8] border border-[#ddd]" />
                <span>Light</span>
              </button>
            </div>
          </div>

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

        <Show when={page() === "storage"}>
          <h2 class="text-sm font-semibold mb-4">Storage</h2>

          {/* Quota gauge */}
          <div class="mb-6">
            <div class="flex items-end justify-between mb-2">
              <div>
                <div class="text-os-text">{formatSize(usedBytes())} <span class="text-os-text-muted">used</span></div>
                <div class="text-[10px] text-os-text-muted">of {formatSize(STORAGE_QUOTA_BYTES)} quota</div>
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
