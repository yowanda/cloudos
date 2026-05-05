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
import { windowStore, minimizeWindow } from "./stores/window-store";
import { registerAllApps } from "./apps";
import LockScreen from "./shell/LockScreen";
import { lockScreen } from "./stores/auth-store";
import { ToastLayer, NotificationCenter } from "./shell/Notifications";
import { notify } from "./stores/notification-store";
import BootScreen from "./shell/BootScreen";
import { DesktopWidgets } from "./shell/Widgets";

const App: Component = () => {
  const [booted, setBooted] = createSignal(false);

  onMount(() => {
    registerAllApps();
    // Alt+Tab: Window switcher
    registerShortcut({
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
      key: "Meta",
      handler: toggleStartMenu,
      description: "Toggle Start Menu",
    });

    // Ctrl+D: Show desktop (minimize all)
    registerShortcut({
      key: "d",
      ctrl: true,
      handler: () => {
        windowStore.windows.forEach((w) => {
          if (w.state !== "minimized") minimizeWindow(w.id);
        });
      },
      description: "Show desktop",
    });

    // Ctrl+L: Lock screen
    registerShortcut({
      key: "l",
      ctrl: true,
      handler: lockScreen,
      description: "Lock screen",
    });

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
        <LockScreen />
      </div>
    </ThemeProvider>
  );
};

export default App;
