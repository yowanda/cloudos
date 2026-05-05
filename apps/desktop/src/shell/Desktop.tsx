import { Component } from "solid-js";
import { wallpaper, theme, setTheme } from "../stores/theme-store";
import { showContextMenu, hideContextMenu } from "../stores/contextmenu-store";
import { setStartMenuOpen } from "../stores/startmenu-store";
import { darkTheme } from "../theme/themes/dark";
import { lightTheme } from "../theme/themes/light";

const Desktop: Component = () => {
  const currentWallpaper = () => {
    if (wallpaper()) return wallpaper();
    return theme() === "dark" ? darkTheme.wallpaper : lightTheme.wallpaper;
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, [
      {
        label: theme() === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
        icon: theme() === "dark" ? "☀️" : "🌙",
        action: () => setTheme(theme() === "dark" ? "light" : "dark"),
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
