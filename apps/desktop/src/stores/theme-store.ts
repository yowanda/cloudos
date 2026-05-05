import { createSignal } from "solid-js";

export type ThemeMode = "dark" | "light";

const [theme, setTheme] = createSignal<ThemeMode>("dark");
const [wallpaper, setWallpaper] = createSignal<string>("");
const [accentColor, setAccentColor] = createSignal<string>("#6366f1");

export { theme, setTheme, wallpaper, setWallpaper, accentColor, setAccentColor };
