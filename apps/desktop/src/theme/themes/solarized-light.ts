import type { CloudOSTheme } from "../types";

/**
 * Solarized Light — Ethan Schoonover's classic palette, light variant.
 * Background `base3` (#fdf6e3), foreground `base00` (#657b83), accent
 * `blue` (#268bd2). https://ethanschoonover.com/solarized/
 */
export const solarizedLightTheme: CloudOSTheme = {
  id: "solarized-light",
  name: "Solarized Light",
  kind: "builtin",
  base: "light",
  colors: {
    "--color-os-bg": "#fdf6e3",
    "--color-os-surface": "rgba(101, 123, 131, 0.08)",
    "--color-os-surface-hover": "rgba(101, 123, 131, 0.14)",
    "--color-os-border": "rgba(101, 123, 131, 0.18)",
    "--color-os-text": "#586e75",
    "--color-os-text-muted": "#93a1a1",
    "--color-os-accent": "#268bd2",
    "--color-os-accent-hover": "#1e7ec4",
    "--color-os-danger": "#dc322f",
    "--color-os-warning": "#b58900",
    "--color-os-success": "#859900",
    "--color-os-taskbar": "rgba(238, 232, 213, 0.92)",
    "--color-os-dock": "rgba(238, 232, 213, 0.82)",
    "--color-os-window": "rgba(253, 246, 227, 0.95)",
    "--color-os-window-title": "rgba(238, 232, 213, 0.95)",
  },
  wallpaper: "linear-gradient(135deg, #fdf6e3 0%, #eee8d5 100%)",
};
