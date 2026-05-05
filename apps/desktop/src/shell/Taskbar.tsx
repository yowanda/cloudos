import { Component, For, Show, createSignal, createEffect, onCleanup } from "solid-js";
import { currentDesktopWindows, windowStore, focusWindow, minimizeWindow, openWindow } from "../stores/window-store";
import { toggleStartMenu, startMenuOpen } from "../stores/startmenu-store";
import { openSpotlight } from "./Spotlight";
import { hideContextMenu } from "../stores/contextmenu-store";
import { toggleNotificationCenter, unreadCount } from "../stores/notification-store";
import { WorkspaceTrayButton } from "./WorkspaceSwitcher";
import { conflictCount } from "../vfs/conflicts";
import { isMobile } from "../stores/viewport-store";

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
      <Show when={!isMobile()}>
        <span class="text-os-text-muted text-[10px]">{date()}</span>
      </Show>
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
      {/* Start Button — text label collapses to icon-only on mobile */}
      <button
        class="flex items-center gap-1.5 h-7 rounded-md text-xs font-semibold transition-colors"
        classList={{
          "bg-os-accent text-white": startMenuOpen(),
          "text-os-text hover:bg-os-surface-hover": !startMenuOpen(),
          "px-3": !isMobile(),
          "px-2": isMobile(),
        }}
        onClick={handleStartClick}
        aria-label="Apps menu"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="1" width="6" height="6" rx="1" />
          <rect x="9" y="1" width="6" height="6" rx="1" />
          <rect x="1" y="9" width="6" height="6" rx="1" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
        </svg>
        <Show when={!isMobile()}>
          <span>Apps</span>
        </Show>
      </button>

      <button
        class="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs text-os-text-muted hover:bg-os-surface-hover transition-colors"
        title="Spotlight (Ctrl+K)"
        onClick={() => openSpotlight()}
        aria-label="Search"
      >
        <span>🔍</span>
        <span class="hidden md:inline">Search</span>
        <kbd class="hidden md:inline px-1 text-[9px] rounded bg-os-surface border border-os-border">
          Ctrl K
        </kbd>
      </button>

      <div class="w-px h-5 bg-os-border mx-1" />

      {/* Running Windows (current workspace only). On mobile we drop
          the per-window text label (icons stay tappable) since the
          taskbar would otherwise overflow on a 360 px viewport. */}
      <div class="flex-1 flex items-center gap-0.5 overflow-x-auto">
        <For each={currentDesktopWindows()}>
          {(win) => (
            <button
              class="flex items-center gap-1.5 h-7 rounded-md text-xs transition-colors truncate"
              classList={{
                "bg-os-accent/20 text-os-accent-hover border border-os-accent/30": win.focused,
                "text-os-text-muted hover:bg-os-surface-hover": !win.focused,
                "opacity-50": win.state === "minimized",
                "px-2.5 max-w-[180px]": !isMobile(),
                "px-2": isMobile(),
              }}
              onClick={() => handleTaskClick(win.id, win.state)}
              title={win.title}
              aria-label={win.title}
            >
              <span class="text-sm">{win.icon}</span>
              <Show when={!isMobile()}>
                <span class="truncate">{win.title}</span>
              </Show>
            </button>
          )}
        </For>
      </div>

      {/* System Tray. Wi-Fi / Volume placeholders + the workspace
          switcher button are hidden on mobile to free pixel budget. */}
      <div class="flex items-center gap-2">
        <Show when={!isMobile()}>
          <WorkspaceTrayButton />
          <div class="w-px h-5 bg-os-border" />
          <button class="text-os-text-muted hover:text-os-text text-sm transition-colors" title="Wi-Fi">
            📶
          </button>
          <button class="text-os-text-muted hover:text-os-text text-sm transition-colors" title="Volume">
            🔊
          </button>
        </Show>
        <Show when={conflictCount() > 0}>
          <button
            class="relative text-os-warning hover:brightness-110 text-sm transition-colors"
            title={`${conflictCount()} pending sync conflict${conflictCount() === 1 ? "" : "s"} — open Settings → Backend to resolve`}
            onClick={(e) => {
              e.stopPropagation();
              openWindow({ appId: "com.cloudos.settings", title: "Settings", icon: "⚙️", width: 800, height: 600 });
            }}
          >
            🔀
            <span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-os-warning text-white text-[8px] flex items-center justify-center font-bold">
              {conflictCount() > 9 ? "9+" : conflictCount()}
            </span>
          </button>
        </Show>
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
