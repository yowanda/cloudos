import { Component, For, Show, createSignal, createEffect, onCleanup } from "solid-js";
import { windowStore, focusWindow, minimizeWindow } from "../stores/window-store";
import { toggleStartMenu, startMenuOpen } from "../stores/startmenu-store";
import { hideContextMenu } from "../stores/contextmenu-store";
import { toggleNotificationCenter, unreadCount } from "../stores/notification-store";

const Clock: Component = () => {
  const [time, setTime] = createSignal("");
  const [date, setDate] = createSignal("");

  const update = () => {
    const now = new Date();
    setTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    setDate(now.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }));
  };

  createEffect(() => {
    update();
    const timer = setInterval(update, 1000);
    onCleanup(() => clearInterval(timer));
  });

  return (
    <div class="flex flex-col items-end text-xs leading-tight">
      <span class="text-os-text font-medium">{time()}</span>
      <span class="text-os-text-muted text-[10px]">{date()}</span>
    </div>
  );
};

const Taskbar: Component = () => {
  const handleStartClick = (e: MouseEvent) => {
    e.stopPropagation();
    hideContextMenu();
    toggleStartMenu();
  };

  const handleTaskClick = (id: string, state: string) => {
    if (state === "minimized") {
      focusWindow(id);
    } else {
      const w = windowStore.windows.find((w) => w.id === id);
      if (w?.focused) {
        minimizeWindow(id);
      } else {
        focusWindow(id);
      }
    }
  };

  return (
    <div class="absolute top-0 left-0 right-0 h-9 z-[9999] flex items-center px-2 gap-1 bg-os-taskbar backdrop-blur-xl border-b border-os-border">
      {/* Start Button */}
      <button
        class="flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-semibold transition-colors"
        classList={{
          "bg-os-accent text-white": startMenuOpen(),
          "text-os-text hover:bg-os-surface-hover": !startMenuOpen(),
        }}
        onClick={handleStartClick}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="1" width="6" height="6" rx="1" />
          <rect x="9" y="1" width="6" height="6" rx="1" />
          <rect x="1" y="9" width="6" height="6" rx="1" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
        </svg>
        <span>Apps</span>
      </button>

      <div class="w-px h-5 bg-os-border mx-1" />

      {/* Running Windows */}
      <div class="flex-1 flex items-center gap-0.5 overflow-x-auto">
        <For each={windowStore.windows}>
          {(win) => (
            <button
              class="flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs transition-colors max-w-[180px] truncate"
              classList={{
                "bg-os-accent/20 text-os-accent-hover border border-os-accent/30": win.focused,
                "text-os-text-muted hover:bg-os-surface-hover": !win.focused,
                "opacity-50": win.state === "minimized",
              }}
              onClick={() => handleTaskClick(win.id, win.state)}
              title={win.title}
            >
              <span class="text-sm">{win.icon}</span>
              <span class="truncate">{win.title}</span>
            </button>
          )}
        </For>
      </div>

      {/* System Tray */}
      <div class="flex items-center gap-2">
        <button class="text-os-text-muted hover:text-os-text text-sm transition-colors" title="Wi-Fi">
          📶
        </button>
        <button class="text-os-text-muted hover:text-os-text text-sm transition-colors" title="Volume">
          🔊
        </button>
        <button
          class="relative text-os-text-muted hover:text-os-text text-sm transition-colors"
          title="Notifications"
          onClick={(e) => { e.stopPropagation(); toggleNotificationCenter(); }}
        >
          🔔
          <Show when={unreadCount() > 0}>
            <span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-os-danger text-white text-[8px] flex items-center justify-center font-bold">
              {unreadCount() > 9 ? "9+" : unreadCount()}
            </span>
          </Show>
        </button>
        <Clock />
      </div>
    </div>
  );
};

export default Taskbar;
