import { Component, Show, onMount, createSignal } from "solid-js";
import Desktop from "./shell/Desktop";
import Taskbar from "./shell/Taskbar";
import Dock from "./shell/Dock";
import { WindowLayer } from "./window/WindowLayer";
import { ContextMenuLayer } from "./shell/ContextMenu";
import { StartMenu } from "./shell/StartMenu";
import { WindowSwitcher, openSwitcher, closeSwitcher, nextWindow } from "./window/WindowSwitcher";
import { ThemeProvider } from "./theme/theme-provider";
import { registerShortcut, initShortcuts } from "./core/shortcut-manager";
import { toggleStartMenu } from "./stores/startmenu-store";
import { currentDesktopWindows, minimizeWindow } from "./stores/window-store";
import { registerAllApps } from "./apps";
import LockScreen from "./shell/LockScreen";
import { lockScreen } from "./stores/auth-store";
import { ToastLayer, NotificationCenter } from "./shell/Notifications";
import { notify } from "./stores/notification-store";
import BootScreen from "./shell/BootScreen";
import { DesktopWidgets } from "./shell/Widgets";
import { WorkspaceOverlay } from "./shell/WorkspaceSwitcher";
import { desktops, nextDesktop, prevDesktop, switchDesktop } from "./stores/desktop-store";
import { attachAudioUnlock } from "./core/sound-manager";
import { initVfsSync } from "./vfs/sync";
import SharedFileViewer from "./shell/SharedFileViewer";
import { Spotlight, openSpotlight } from "./shell/Spotlight";

const App: Component = () => {
  const [booted, setBooted] = createSignal(false);
  const [shareToken, setShareToken] = createSignal<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("share");
  });

  onMount(() => {
    registerAllApps();
    attachAudioUnlock();
    void initVfsSync();
    // Alt+Tab: Window switcher
    registerShortcut({
      id: "system.switch-windows",
      key: "Tab",
      alt: true,
      handler: () => {
        openSwitcher();
        nextWindow();
      },
      description: "Switch windows",
    });

    // Alt key release closes switcher
    document.addEventListener("keyup", (e) => {
      if (e.key === "Alt") closeSwitcher();
    });

    // Super / Meta: Toggle start menu
    registerShortcut({
      id: "system.toggle-start-menu",
      key: "Meta",
      locked: true,
      handler: toggleStartMenu,
      description: "Toggle Start Menu",
    });

    // Ctrl+D: Show desktop (minimize all on current workspace)
    registerShortcut({
      id: "system.show-desktop",
      key: "d",
      ctrl: true,
      handler: () => {
        for (const w of currentDesktopWindows()) {
          if (w.state !== "minimized") minimizeWindow(w.id);
        }
      },
      description: "Show desktop",
    });

    // Ctrl+L: Lock screen
    registerShortcut({
      id: "system.lock-screen",
      key: "l",
      ctrl: true,
      handler: lockScreen,
      description: "Lock screen",
    });

    // Ctrl+K / Ctrl+Space: open Spotlight search
    registerShortcut({
      id: "system.spotlight",
      key: "k",
      ctrl: true,
      handler: openSpotlight,
      description: "Open Spotlight search",
    });
    registerShortcut({
      id: "system.spotlight.alt",
      key: " ",
      ctrl: true,
      handler: openSpotlight,
      description: "Open Spotlight search",
    });

    // Ctrl+Alt+Right / Left: cycle workspaces
    registerShortcut({
      id: "workspace.next",
      key: "ArrowRight",
      ctrl: true,
      alt: true,
      handler: nextDesktop,
      description: "Next workspace",
    });
    registerShortcut({
      id: "workspace.prev",
      key: "ArrowLeft",
      ctrl: true,
      alt: true,
      handler: prevDesktop,
      description: "Previous workspace",
    });

    // Ctrl+Alt+1..9: jump to workspace N
    for (let i = 1; i <= 9; i++) {
      registerShortcut({
        id: `workspace.switch.${i}`,
        key: String(i),
        ctrl: true,
        alt: true,
        locked: true,
        handler: () => {
          const list = desktops();
          const target = list[i - 1];
          if (target) switchDesktop(target.id);
        },
        description: `Switch to workspace ${i}`,
      });
    }

    initShortcuts();
  });

  const handleBootComplete = () => {
    setBooted(true);
    setTimeout(() => {
      notify({
        title: "Welcome to CloudOS",
        message: "Your browser-based operating system is ready.",
        type: "info",
        icon: "☁️",
      });
    }, 500);
  };

  return (
    <ThemeProvider>
      <div class="relative w-full h-full overflow-hidden bg-os-bg">
        <Show when={!booted()}>
          <BootScreen onComplete={handleBootComplete} />
        </Show>
        <Desktop />
        <DesktopWidgets />
        <WindowLayer />
        <StartMenu />
        <ContextMenuLayer />
        <WindowSwitcher />
        <NotificationCenter />
        <ToastLayer />
        <Taskbar />
        <Dock />
        <WorkspaceOverlay />
        <LockScreen />
        <Spotlight />
        <Show when={shareToken()}>
          {(t) => (
            <SharedFileViewer
              token={t()}
              onDismiss={() => {
                setShareToken(null);
                if (typeof window !== "undefined") {
                  const url = new URL(window.location.href);
                  url.searchParams.delete("share");
                  window.history.replaceState({}, "", url.toString());
                }
              }}
            />
          )}
        </Show>
      </div>
    </ThemeProvider>
  );
};

export default App;
