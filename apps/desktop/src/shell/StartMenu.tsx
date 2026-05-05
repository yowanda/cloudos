import { Component, For, Show, createMemo, createSignal } from "solid-js";
import { startMenuOpen, setStartMenuOpen } from "../stores/startmenu-store";
import { openWindow, windowStore, focusWindow } from "../stores/window-store";
import { listManifests, manifestsVersion } from "../core/app-manifest";
import { recentApps, recordRecent } from "../stores/recents-store";

interface AppEntry {
  id: string;
  name: string;
  icon: string;
  category: string;
}

const builtinApps: AppEntry[] = [
  { id: "com.cloudos.files", name: "Files", icon: "📁", category: "System" },
  { id: "com.cloudos.terminal", name: "Terminal", icon: "⬛", category: "System" },
  { id: "com.cloudos.editor", name: "Text Editor", icon: "📝", category: "System" },
  { id: "com.cloudos.browser", name: "Browser", icon: "🌐", category: "System" },
  { id: "com.cloudos.settings", name: "Settings", icon: "⚙️", category: "System" },
  { id: "com.cloudos.calculator", name: "Calculator", icon: "🧮", category: "Utilities" },
  { id: "com.cloudos.imageviewer", name: "Image Viewer", icon: "🖼️", category: "Media" },
  { id: "com.cloudos.mediaplayer", name: "Media Player", icon: "🎵", category: "Media" },
  { id: "com.cloudos.notes", name: "Notes", icon: "📒", category: "Productivity" },
  { id: "com.cloudos.appstore", name: "App Store", icon: "🏪", category: "System" },
  { id: "com.cloudos.shortcuts", name: "Shortcuts", icon: "⌨️", category: "System" },
  { id: "com.cloudos.assistant", name: "Assistant", icon: "🤖", category: "Productivity" },
];

export const StartMenu: Component = () => {
  const [query, setQuery] = createSignal("");

  const allApps = createMemo<AppEntry[]>(() => {
    void manifestsVersion();
    const seen = new Set(builtinApps.map((a) => a.id));
    const extra: AppEntry[] = [];
    for (const m of listManifests()) {
      if (seen.has(m.id)) continue;
      extra.push({
        id: m.id,
        name: m.name,
        icon: m.icon,
        category: m.category ?? "Apps",
      });
    }
    return [...builtinApps, ...extra];
  });

  const filteredApps = createMemo<AppEntry[]>(() => {
    const q = query().trim().toLowerCase();
    if (!q) return allApps();
    return allApps().filter(
      (a) => a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q),
    );
  });

  const recentEntries = createMemo<AppEntry[]>(() => {
    const byId = new Map(allApps().map((a) => [a.id, a]));
    return recentApps()
      .map((id) => byId.get(id))
      .filter((a): a is AppEntry => Boolean(a));
  });

  const launchApp = (app: AppEntry) => {
    setStartMenuOpen(false);
    setQuery("");
    recordRecent(app.id);
    const existing = windowStore.windows.find((w) => w.appId === app.id);
    if (existing) {
      focusWindow(existing.id);
      return;
    }
    void manifestsVersion();
    const m = listManifests().find((x) => x.id === app.id);
    openWindow({
      appId: app.id,
      title: app.name,
      icon: app.icon,
      width: m?.window?.width,
      height: m?.window?.height,
      resizable: m?.window?.resizable,
      minWidth: m?.window?.minWidth,
      minHeight: m?.window?.minHeight,
    });
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
            value={query()}
            onInput={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filteredApps().length > 0) launchApp(filteredApps()[0]);
              if (e.key === "Escape") setStartMenuOpen(false);
            }}
            autofocus
          />
        </div>

        {/* Recent (only shown when not searching) */}
        <Show when={query().trim() === "" && recentEntries().length > 0}>
          <div class="px-3 pt-2">
            <p class="text-[10px] text-os-text-muted uppercase tracking-wider mb-1.5">Recent</p>
            <div class="grid grid-cols-3 gap-2">
              <For each={recentEntries()}>
                {(app) => (
                  <button
                    class="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-os-surface-hover transition-colors"
                    onClick={() => launchApp(app)}
                  >
                    <span class="text-xl">{app.icon}</span>
                    <span class="text-[9px] text-os-text-muted text-center leading-tight">{app.name}</span>
                  </button>
                )}
              </For>
            </div>
            <div class="mt-2 border-t border-os-border" />
          </div>
        </Show>

        {/* App Grid */}
        <div class="p-3 grid grid-cols-3 gap-2 overflow-y-auto max-h-[50vh]">
          <Show when={filteredApps().length > 0} fallback={
            <div class="col-span-3 text-center text-[11px] text-os-text-muted py-6">
              No apps match "{query()}"
            </div>
          }>
            <For each={filteredApps()}>
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
          </Show>
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
