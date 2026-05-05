import { Component, For, Show, createSignal, onMount, onCleanup } from "solid-js";
import { windowStore, focusWindow } from "../stores/window-store";

const [showSwitcher, setShowSwitcher] = createSignal(false);
const [selectedIndex, setSelectedIndex] = createSignal(0);

export function openSwitcher() {
  if (windowStore.windows.length <= 1) return;
  setSelectedIndex(1);
  setShowSwitcher(true);
}

export function closeSwitcher() {
  if (showSwitcher()) {
    const wins = windowStore.windows.filter((w) => w.state !== "minimized");
    const sorted = [...wins].sort((a, b) => b.zIndex - a.zIndex);
    const selected = sorted[selectedIndex()];
    if (selected) focusWindow(selected.id);
    setShowSwitcher(false);
  }
}

export function nextWindow() {
  const wins = windowStore.windows.filter((w) => w.state !== "minimized");
  setSelectedIndex((i) => (i + 1) % wins.length);
}

export const WindowSwitcher: Component = () => {
  const sortedWindows = () => {
    const wins = windowStore.windows.filter((w) => w.state !== "minimized");
    return [...wins].sort((a, b) => b.zIndex - a.zIndex);
  };

  return (
    <Show when={showSwitcher()}>
      <div class="fixed inset-0 z-[99990] flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div class="flex gap-3 p-4 rounded-2xl bg-os-window border border-os-border shadow-2xl">
          <For each={sortedWindows()}>
            {(win, idx) => (
              <div
                class="flex flex-col items-center gap-2 p-3 rounded-xl transition-colors min-w-[80px]"
                classList={{
                  "bg-os-accent/20 ring-2 ring-os-accent": idx() === selectedIndex(),
                  "hover:bg-os-surface-hover": idx() !== selectedIndex(),
                }}
              >
                <span class="text-3xl">{win.icon}</span>
                <span class="text-[10px] text-os-text text-center max-w-[72px] truncate">
                  {win.title}
                </span>
              </div>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
};
