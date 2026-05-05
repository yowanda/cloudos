import { Component } from "solid-js";
import { wallpaper, currentTheme, setActiveTheme } from "../stores/theme-store";
import { showContextMenu, hideContextMenu } from "../stores/contextmenu-store";
import { setStartMenuOpen } from "../stores/startmenu-store";

const Desktop: Component = () => {
  // Wallpaper override (set via Settings) takes priority over the
  // theme's own wallpaper.
  const currentWallpaper = () => wallpaper() || currentTheme().wallpaper;

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const t = currentTheme();
    const isDark = t.base === "dark";
    showContextMenu(e.clientX, e.clientY, [
      {
        label: isDark ? "Switch to Light Mode" : "Switch to Dark Mode",
        icon: isDark ? "☀️" : "🌙",
        action: () => setActiveTheme(isDark ? "light" : "dark"),
      },
      { label: "Change Wallpaper", icon: "🖼️", action: () => {} },
      { separator: true, label: "" },
      { label: "New Folder", icon: "📁", action: () => {} },
      { label: "New File", icon: "📄", action: () => {} },
      { separator: true, label: "" },
      { label: "Refresh", icon: "🔄", action: () => window.location.reload() },
    ]);
  };

  const handleClick = () => {
    hideContextMenu();
    setStartMenuOpen(false);
  };

  return (
    <div
      class="absolute inset-0 z-0"
      style={{ background: currentWallpaper() }}
      onContextMenu={handleContextMenu}
      onClick={handleClick}
    />
  );
};

export default Desktop;
