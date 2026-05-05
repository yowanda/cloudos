/**
 * Shared theme type. A theme is a flat map of CSS custom properties
 * plus a `wallpaper` (any valid CSS `background` value) and a stable
 * `id` so we can refer to themes from localStorage / Settings.
 *
 * The `kind` distinguishes built-in themes (which can never be deleted)
 * from user-imported "custom" themes (which can be).
 */
export interface CloudOSTheme {
  id: string;
  name: string;
  kind: "builtin" | "custom";
  /** "dark" or "light" — drives a few light-vs-dark UI heuristics. */
  base: "dark" | "light";
  colors: Record<string, string>;
  wallpaper: string;
  /** Optional small swatch used for theme picker tile (defaults to bg). */
  preview?: string;
}

/**
 * The exportable subset of a CloudOSTheme. We strip `kind` (always
 * exported as "custom") so re-importing an exported builtin doesn't
 * pretend it's a builtin.
 */
export interface ExportedTheme {
  id: string;
  name: string;
  base: "dark" | "light";
  colors: Record<string, string>;
  wallpaper: string;
  preview?: string;
}

/** The CSS variable names every theme must define. Validated on import. */
export const REQUIRED_THEME_VARS: readonly string[] = [
  "--color-os-bg",
  "--color-os-surface",
  "--color-os-surface-hover",
  "--color-os-border",
  "--color-os-text",
  "--color-os-text-muted",
  "--color-os-accent",
  "--color-os-accent-hover",
  "--color-os-danger",
  "--color-os-warning",
  "--color-os-success",
  "--color-os-taskbar",
  "--color-os-dock",
  "--color-os-window",
  "--color-os-window-title",
] as const;
