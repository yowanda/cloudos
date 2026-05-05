import type { CloudOSTheme } from "../types";

export const lightTheme: CloudOSTheme = {
  id: "light",
  name: "Light",
  kind: "builtin",
  base: "light",
  colors: {
    "--color-os-bg": "#f0f4f8",
    "--color-os-surface": "rgba(0, 0, 0, 0.04)",
    "--color-os-surface-hover": "rgba(0, 0, 0, 0.08)",
    "--color-os-border": "rgba(0, 0, 0, 0.1)",
    "--color-os-text": "#1e293b",
    "--color-os-text-muted": "#64748b",
    "--color-os-accent": "#6366f1",
    "--color-os-accent-hover": "#4f46e5",
    "--color-os-danger": "#ef4444",
    "--color-os-warning": "#f59e0b",
    "--color-os-success": "#22c55e",
    "--color-os-taskbar": "rgba(255, 255, 255, 0.85)",
    "--color-os-dock": "rgba(255, 255, 255, 0.75)",
    "--color-os-window": "rgba(255, 255, 255, 0.92)",
    "--color-os-window-title": "rgba(245, 245, 250, 0.95)",
  },
  wallpaper: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
};
