import { Component, For, createSignal, Show } from "solid-js";
import { theme, setTheme, accentColor, setAccentColor } from "../stores/theme-store";

type SettingsPage = "appearance" | "about";

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

const Settings: Component<{ windowId: string }> = () => {
  const [page, setPage] = createSignal<SettingsPage>("appearance");

  const sidebarItems: { id: SettingsPage; label: string; icon: string }[] = [
    { id: "appearance", label: "Appearance", icon: "🎨" },
    { id: "about", label: "About", icon: "ℹ️" },
  ];

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
