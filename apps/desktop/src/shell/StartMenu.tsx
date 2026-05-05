import { Component, For, Show } from "solid-js";
import { startMenuOpen, setStartMenuOpen } from "../stores/startmenu-store";
import { openWindow, windowStore, focusWindow } from "../stores/window-store";

interface AppEntry {
  id: string;
  name: string;
  icon: string;
  category: string;
}

const allApps: AppEntry[] = [
  { id: "com.cloudos.files", name: "Files", icon: "📁", category: "System" },
  { id: "com.cloudos.terminal", name: "Terminal", icon: "⬛", category: "System" },
  { id: "com.cloudos.editor", name: "Text Editor", icon: "📝", category: "System" },
  { id: "com.cloudos.browser", name: "Browser", icon: "🌐", category: "System" },
  { id: "com.cloudos.settings", name: "Settings", icon: "⚙️", category: "System" },
  { id: "com.cloudos.calculator", name: "Calculator", icon: "🧮", category: "Utilities" },
  { id: "com.cloudos.imageviewer", name: "Image Viewer", icon: "🖼️", category: "Media" },
  { id: "com.cloudos.mediaplayer", name: "Media Player", icon: "🎵", category: "Media" },
  { id: "com.cloudos.notes", name: "Notes", icon: "📒", category: "Productivity" },
];

export const StartMenu: Component = () => {
  const launchApp = (app: AppEntry) => {
    setStartMenuOpen(false);
    const existing = windowStore.windows.find((w) => w.appId === app.id);
    if (existing) {
      focusWindow(existing.id);
    } else {
      openWindow({ appId: app.id, title: app.name, icon: app.icon });
    }
  };

  return (
    <Show when={startMenuOpen()}>
      <div
        class="absolute top-10 left-2 z-[9997] w-72 max-h-[70vh] rounded-xl bg-os-window backdrop-blur-xl border border-os-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search */}
        <div class="p-3 border-b border-os-border">
          <input
            type="text"
            placeholder="Search apps..."
            class="w-full px-3 py-1.5 text-xs rounded-lg bg-os-surface border border-os-border text-os-text placeholder:text-os-text-muted focus:outline-none focus:border-os-accent"
          />
        </div>

        {/* App Grid */}
        <div class="p-3 grid grid-cols-3 gap-2 overflow-y-auto max-h-[50vh]">
          <For each={allApps}>
            {(app) => (
              <button
                class="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-os-surface-hover transition-colors"
                onClick={() => launchApp(app)}
              >
                <span class="text-2xl">{app.icon}</span>
                <span class="text-[10px] text-os-text-muted text-center leading-tight">{app.name}</span>
              </button>
            )}
          </For>
        </div>

        {/* Footer */}
        <div class="p-2 border-t border-os-border flex items-center justify-between">
          <span class="text-[10px] text-os-text-muted px-2">CloudOS v0.1.0</span>
          <button class="text-[10px] text-os-text-muted hover:text-os-text px-2 py-1 rounded hover:bg-os-surface-hover transition-colors">
            ⏻ Power
          </button>
        </div>
      </div>
    </Show>
  );
};
