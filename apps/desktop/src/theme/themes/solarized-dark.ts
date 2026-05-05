import type { CloudOSTheme } from "../types";

/**
 * Solarized Dark — Ethan Schoonover's classic palette adapted for the
 * CloudOS shell. Background `base03` (#002b36), foreground `base0`
 * (#839496), accent `blue` (#268bd2). https://ethanschoonover.com/solarized/
 */
export const solarizedDarkTheme: CloudOSTheme = {
  id: "solarized-dark",
  name: "Solarized Dark",
  kind: "builtin",
  base: "dark",
  colors: {
    "--color-os-bg": "#002b36",
    "--color-os-surface": "rgba(147, 161, 161, 0.08)",
    "--color-os-surface-hover": "rgba(147, 161, 161, 0.14)",
    "--color-os-border": "rgba(147, 161, 161, 0.18)",
    "--color-os-text": "#93a1a1",
    "--color-os-text-muted": "#586e75",
    "--color-os-accent": "#268bd2",
    "--color-os-accent-hover": "#3a9bd9",
    "--color-os-danger": "#dc322f",
    "--color-os-warning": "#b58900",
    "--color-os-success": "#859900",
    "--color-os-taskbar": "rgba(0, 32, 38, 0.9)",
    "--color-os-dock": "rgba(0, 32, 38, 0.78)",
    "--color-os-window": "rgba(7, 54, 66, 0.94)",
    "--color-os-window-title": "rgba(0, 32, 38, 0.96)",
  },
  wallpaper: "linear-gradient(135deg, #002b36 0%, #073642 60%, #002b36 100%)",
};
