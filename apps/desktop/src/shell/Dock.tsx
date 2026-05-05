import { Component, For } from "solid-js";
import { openWindow, windowStore, focusWindow } from "../stores/window-store";
import { hideContextMenu } from "../stores/contextmenu-store";
import { setStartMenuOpen } from "../stores/startmenu-store";

interface DockItem {
  id: string;
  name: string;
  icon: string;
}

const defaultDockItems: DockItem[] = [
  { id: "com.cloudos.files", name: "Files", icon: "📁" },
  { id: "com.cloudos.terminal", name: "Terminal", icon: "⬛" },
  { id: "com.cloudos.editor", name: "Editor", icon: "📝" },
  { id: "com.cloudos.browser", name: "Browser", icon: "🌐" },
  { id: "com.cloudos.settings", name: "Settings", icon: "⚙️" },
];

const Dock: Component = () => {
  const handleClick = (item: DockItem) => {
    hideContextMenu();
    setStartMenuOpen(false);

    const existing = windowStore.windows.find((w) => w.appId === item.id);
    if (existing) {
      focusWindow(existing.id);
    } else {
      openWindow({
        appId: item.id,
        title: item.name,
        icon: item.icon,
      });
    }
  };

  const isRunning = (appId: string) => windowStore.windows.some((w) => w.appId === appId);

  return (
    <div class="absolute bottom-2 left-1/2 -translate-x-1/2 z-[9998] flex items-end gap-1 px-3 py-1.5 rounded-2xl bg-os-dock backdrop-blur-xl border border-os-border">
      <For each={defaultDockItems}>
        {(item) => (
          <button
            class="relative flex flex-col items-center group"
            onClick={() => handleClick(item)}
            title={item.name}
          >
            <span
              class="text-2xl p-2 rounded-xl transition-all duration-200 group-hover:scale-125 group-hover:bg-os-surface-hover group-active:scale-110"
            >
              {item.icon}
            </span>
            {isRunning(item.id) && (
              <div class="absolute -bottom-0.5 w-1 h-1 rounded-full bg-os-accent" />
            )}
          </button>
        )}
      </For>
    </div>
  );
};

export default Dock;
