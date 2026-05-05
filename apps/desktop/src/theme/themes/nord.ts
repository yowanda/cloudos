import type { CloudOSTheme } from "../types";

/**
 * Nord — arctic, north-bluish palette by Arctic Ice Studio. Polar Night
 * for backgrounds, Snow Storm for text, Frost for accents.
 * https://www.nordtheme.com/
 */
export const nordTheme: CloudOSTheme = {
  id: "nord",
  name: "Nord",
  kind: "builtin",
  base: "dark",
  colors: {
    "--color-os-bg": "#2e3440",
    "--color-os-surface": "rgba(216, 222, 233, 0.08)",
    "--color-os-surface-hover": "rgba(216, 222, 233, 0.14)",
    "--color-os-border": "rgba(216, 222, 233, 0.16)",
    "--color-os-text": "#eceff4",
    "--color-os-text-muted": "#8893a4",
    "--color-os-accent": "#88c0d0",
    "--color-os-accent-hover": "#8fbcbb",
    "--color-os-danger": "#bf616a",
    "--color-os-warning": "#ebcb8b",
    "--color-os-success": "#a3be8c",
    "--color-os-taskbar": "rgba(46, 52, 64, 0.9)",
    "--color-os-dock": "rgba(46, 52, 64, 0.78)",
    "--color-os-window": "rgba(59, 66, 82, 0.94)",
    "--color-os-window-title": "rgba(46, 52, 64, 0.96)",
  },
  wallpaper: "linear-gradient(135deg, #2e3440 0%, #3b4252 50%, #434c5e 100%)",
};
