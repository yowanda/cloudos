import { Component } from "solid-js";
import { wallpaper } from "../stores/theme-store";
import { showContextMenu, hideContextMenu } from "../stores/contextmenu-store";
import { setStartMenuOpen } from "../stores/startmenu-store";

const Desktop: Component = () => {
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, [
      { label: "Change Wallpaper", action: () => {} },
      { label: "Display Settings", action: () => {} },
      { separator: true, label: "" },
      { label: "New Folder", action: () => {} },
      { label: "New File", action: () => {} },
      { separator: true, label: "" },
      { label: "Refresh", action: () => window.location.reload() },
    ]);
  };

  const handleClick = () => {
    hideContextMenu();
    setStartMenuOpen(false);
  };

  return (
    <div
      class="absolute inset-0 z-0"
      style={{
        background: wallpaper()
          ? `url(${wallpaper()}) center/cover no-repeat`
          : "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
      }}
      onContextMenu={handleContextMenu}
      onClick={handleClick}
    />
  );
};

export default Desktop;
