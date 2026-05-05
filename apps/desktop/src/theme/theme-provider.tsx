import { createEffect, type ParentComponent } from "solid-js";
import { currentTheme } from "../stores/theme-store";

/**
 * Applies the active theme's CSS custom properties to <html>. Reactive
 * to `currentTheme()` so switching, importing, or removing themes
 * re-applies immediately.
 */
export const ThemeProvider: ParentComponent = (props) => {
  createEffect(() => {
    const t = currentTheme();
    const root = document.documentElement;
    for (const [key, value] of Object.entries(t.colors)) {
      root.style.setProperty(key, value);
    }
  });

  return <>{props.children}</>;
};
