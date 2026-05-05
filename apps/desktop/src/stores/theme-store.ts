import { createSignal } from "solid-js";
import type { CloudOSTheme, ExportedTheme } from "../theme/types";
import { REQUIRED_THEME_VARS } from "../theme/types";
import { darkTheme } from "../theme/themes/dark";
import { lightTheme } from "../theme/themes/light";
import { solarizedDarkTheme } from "../theme/themes/solarized-dark";
import { solarizedLightTheme } from "../theme/themes/solarized-light";
import { nordTheme } from "../theme/themes/nord";

/**
 * @deprecated The store used to expose just `"dark" | "light"`. We keep
 * the shape for backwards compatibility (Settings + Desktop both compare
 * against `theme()`), but the source of truth is now `currentTheme()`.
 */
export type ThemeMode = "dark" | "light" | (string & {});

const BUILTIN_THEMES: CloudOSTheme[] = [
  darkTheme,
  lightTheme,
  solarizedDarkTheme,
  solarizedLightTheme,
  nordTheme,
];

const ACTIVE_KEY = "cloudos:theme:active";
const CUSTOM_KEY = "cloudos:theme:custom";

function loadActiveId(): string {
  if (typeof window === "undefined") return darkTheme.id;
  try {
    return window.localStorage.getItem(ACTIVE_KEY) ?? darkTheme.id;
  } catch {
    return darkTheme.id;
  }
}

function loadCustomThemes(): CloudOSTheme[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as CloudOSTheme[];
    if (!Array.isArray(arr)) return [];
    return arr.filter((t) => validateTheme(t).ok).map((t) => ({ ...t, kind: "custom" as const }));
  } catch {
    return [];
  }
}

function persistCustomThemes(arr: CloudOSTheme[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(arr));
  } catch {
    // ignore quota / privacy-mode failures
  }
}

const [activeThemeId, setActiveThemeIdSignal] = createSignal<string>(loadActiveId());
const [customThemes, setCustomThemes] = createSignal<CloudOSTheme[]>(loadCustomThemes());

// Legacy signals (kept for compatibility with existing components).
const [wallpaper, setWallpaper] = createSignal<string>("");
const [accentColor, setAccentColor] = createSignal<string>("#6366f1");

/** All themes available to the user (built-in first, then custom). */
export function availableThemes(): CloudOSTheme[] {
  return [...BUILTIN_THEMES, ...customThemes()];
}

/** Resolve the currently-active theme object. Falls back to dark. */
export function currentTheme(): CloudOSTheme {
  const id = activeThemeId();
  return availableThemes().find((t) => t.id === id) ?? darkTheme;
}

/** Sets the active theme by id. Unknown ids are ignored. */
export function setActiveTheme(id: string) {
  if (!availableThemes().some((t) => t.id === id)) return;
  setActiveThemeIdSignal(id);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ACTIVE_KEY, id);
    } catch {
      // ignore
    }
  }
}

/** Backwards-compat shim. Older code calls `setTheme("dark"|"light")`. */
function setTheme(mode: ThemeMode) {
  setActiveTheme(mode);
}

/** Legacy: returns the active theme id. Components used to compare
 *  against the literal strings "dark" / "light"; with custom themes
 *  installed those checks now reflect the *id*, not the visual base.
 *  Use `currentTheme().base` if you need the visual mode. */
const theme = activeThemeId;

// ─── Theme validation / import / export ─────────────────────────────────

export interface ValidationResult {
  ok: boolean;
  reason?: string;
  /** Variable names that were missing from `colors`. */
  missing?: string[];
}

/**
 * Validates a parsed JSON object as a theme. We require id, name, base,
 * wallpaper (string), and a `colors` object containing every
 * `REQUIRED_THEME_VARS` entry. Extra vars are allowed.
 */
export function validateTheme(t: unknown): ValidationResult {
  if (!t || typeof t !== "object") return { ok: false, reason: "Not an object" };
  const r = t as Partial<CloudOSTheme>;
  if (typeof r.id !== "string" || !r.id) return { ok: false, reason: "Missing id" };
  if (typeof r.name !== "string" || !r.name) return { ok: false, reason: "Missing name" };
  if (r.base !== "dark" && r.base !== "light") return { ok: false, reason: "base must be 'dark' or 'light'" };
  if (typeof r.wallpaper !== "string") return { ok: false, reason: "Missing wallpaper" };
  if (!r.colors || typeof r.colors !== "object") return { ok: false, reason: "Missing colors" };
  const missing = REQUIRED_THEME_VARS.filter((v) => typeof (r.colors as Record<string, string>)[v] !== "string");
  if (missing.length > 0) return { ok: false, reason: `Missing color vars`, missing };
  return { ok: true };
}

export interface ImportResult {
  ok: boolean;
  reason?: string;
  /** Imported theme id on success. Useful for switching to it. */
  id?: string;
}

/**
 * Imports a theme from raw JSON text. The theme is added to the custom
 * registry (kind: "custom") and persisted. Returns the imported id, or
 * an error reason. If a custom theme with the same id already exists,
 * it's overwritten.
 */
export function importThemeFromJSON(json: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    return { ok: false, reason: `Invalid JSON: ${err instanceof Error ? err.message : "parse error"}` };
  }
  const v = validateTheme(parsed);
  if (!v.ok) {
    const missing = v.missing && v.missing.length > 0 ? ` (${v.missing.join(", ")})` : "";
    return { ok: false, reason: `${v.reason}${missing}` };
  }
  const t = parsed as CloudOSTheme;
  // Reserve built-in ids — imported themes can't pretend to be one.
  if (BUILTIN_THEMES.some((b) => b.id === t.id)) {
    return { ok: false, reason: `Theme id "${t.id}" is reserved by a built-in theme` };
  }
  const next = [...customThemes().filter((x) => x.id !== t.id), { ...t, kind: "custom" as const }];
  setCustomThemes(next);
  persistCustomThemes(next);
  return { ok: true, id: t.id };
}

/**
 * Serializes a theme as exportable JSON (kind stripped). Returns
 * undefined if no theme matches the id.
 */
export function exportThemeToJSON(id: string): string | undefined {
  const t = availableThemes().find((x) => x.id === id);
  if (!t) return undefined;
  const out: ExportedTheme = {
    id: t.id,
    name: t.name,
    base: t.base,
    colors: { ...t.colors },
    wallpaper: t.wallpaper,
    preview: t.preview,
  };
  return JSON.stringify(out, null, 2);
}

/** Removes a custom theme. No-op for built-in ids. */
export function removeCustomTheme(id: string) {
  if (BUILTIN_THEMES.some((b) => b.id === id)) return;
  const next = customThemes().filter((t) => t.id !== id);
  setCustomThemes(next);
  persistCustomThemes(next);
  // If the deleted theme was active, fall back to dark.
  if (activeThemeId() === id) setActiveTheme(darkTheme.id);
}

export {
  // legacy + new
  theme,
  setTheme,
  activeThemeId,
  // wallpaper / accent are still simple signals
  wallpaper,
  setWallpaper,
  accentColor,
  setAccentColor,
};
