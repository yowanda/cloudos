import { createEffect, type ParentComponent } from "solid-js";
import { theme } from "../stores/theme-store";
import { darkTheme } from "./themes/dark";
import { lightTheme } from "./themes/light";

const themes = { dark: darkTheme, light: lightTheme };

export const ThemeProvider: ParentComponent = (props) => {
  createEffect(() => {
    const current = themes[theme()];
    const root = document.documentElement;
    for (const [key, value] of Object.entries(current.colors)) {
      root.style.setProperty(key, value);
    }
  });

  return <>{props.children}</>;
};
