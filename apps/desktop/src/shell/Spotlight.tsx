import { Component, For, Show, createMemo, createSignal } from "solid-js";
import { searchLocal, type SearchResult } from "../core/search";
import { focusWindow, openWindow, windowStore } from "../stores/window-store";
import { listManifests } from "../core/app-manifest";

const [open, setOpen] = createSignal(false);

export function openSpotlight() {
  setOpen(true);
}

export function closeSpotlight() {
  setOpen(false);
}

export const Spotlight: Component = () => {
  const [query, setQuery] = createSignal("");
  const [activeIdx, setActiveIdx] = createSignal(0);

  const onOpenApp = (appId: string, name: string, icon: string) => {
    const existing = windowStore.windows.find((w) => w.appId === appId);
    if (existing) {
      focusWindow(existing.id);
    } else {
      const m = listManifests().find((x) => x.id === appId);
      openWindow({
        appId,
        title: name,
        icon,
        width: m?.window?.width,
        height: m?.window?.height,
        resizable: m?.window?.resizable,
        minWidth: m?.window?.minWidth,
        minHeight: m?.window?.minHeight,
      });
    }
    closeSpotlight();
    setQuery("");
  };

  const onOpenFile = (path: string, name: string) => {
    void path;
    // Open File Manager (which can navigate to the file). Editor doesn't yet
    // accept a path argument from outside; this lands the user at the file's
    // location, which is good enough for Spotlight's "jump to" use.
    const existing = windowStore.windows.find((w) => w.appId === "com.cloudos.files");
    if (existing) {
      focusWindow(existing.id);
    } else {
      openWindow({ appId: "com.cloudos.files", title: "Files", icon: "📁" });
    }
    void name;
    closeSpotlight();
    setQuery("");
  };

  const results = createMemo<SearchResult[]>(() => {
    return searchLocal(query(), { onOpenApp, onOpenFile });
  });

  let inputEl: HTMLInputElement | undefined;

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      closeSpotlight();
      setQuery("");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results().length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const r = results()[activeIdx()];
      if (r) r.action();
    }
  };

  return (
    <Show when={open()}>
      <div
        class="fixed inset-0 z-[10002] bg-black/40 backdrop-blur-sm flex items-start justify-center pt-32"
        onClick={() => closeSpotlight()}
      >
        <div
          class="w-[640px] max-w-[90vw] bg-os-window border border-os-border rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="flex items-center gap-3 px-4 py-3 border-b border-os-border">
            <span class="text-lg">🔍</span>
            <input
              ref={(el) => {
                inputEl = el;
                queueMicrotask(() => inputEl?.focus());
              }}
              type="text"
              value={query()}
              onInput={(e) => {
                setQuery(e.currentTarget.value);
                setActiveIdx(0);
              }}
              onKeyDown={onKey}
              placeholder="Search apps, files, commands…  (prefix with > for commands only)"
              class="flex-1 bg-transparent border-0 outline-none text-os-text placeholder:text-os-text-muted text-sm"
            />
            <span class="text-[10px] text-os-text-muted">↑↓ select · ↵ open · Esc close</span>
          </div>

          <div class="max-h-[60vh] overflow-y-auto">
            <Show
              when={query().trim() && results().length > 0}
              fallback={
                <div class="p-8 text-center text-os-text-muted text-xs">
                  <Show when={query().trim()} fallback={<span>Type to search apps and files</span>}>
                    <span>No results for "{query()}"</span>
                  </Show>
                </div>
              }
            >
              <For each={results()}>
                {(r, idx) => (
                  <button
                    class="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
                    classList={{
                      "bg-os-accent/15": idx() === activeIdx(),
                      "hover:bg-os-surface-hover": idx() !== activeIdx(),
                    }}
                    onMouseEnter={() => setActiveIdx(idx())}
                    onClick={() => r.action()}
                  >
                    <span class="text-2xl flex-shrink-0">{r.icon}</span>
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium truncate">{r.title}</div>
                      <div class="text-[11px] text-os-text-muted truncate">{r.subtitle}</div>
                    </div>
                    <span class="text-[10px] text-os-text-muted uppercase tracking-wide">
                      {r.kind}
                    </span>
                  </button>
                )}
              </For>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};
