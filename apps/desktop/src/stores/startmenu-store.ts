import { createSignal } from "solid-js";

const [startMenuOpen, setStartMenuOpen] = createSignal(false);

export { startMenuOpen, setStartMenuOpen };

export function toggleStartMenu() {
  setStartMenuOpen((prev) => !prev);
}
