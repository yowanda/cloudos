import { Component, onMount } from "solid-js";
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

const App: Component = () => {
  onMount(() => {
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

    initShortcuts();
  });

  return (
    <ThemeProvider>
      <div class="relative w-full h-full overflow-hidden bg-os-bg">
        <Desktop />
        <WindowLayer />
        <StartMenu />
        <ContextMenuLayer />
        <WindowSwitcher />
        <Taskbar />
        <Dock />
      </div>
    </ThemeProvider>
  );
};

export default App;
