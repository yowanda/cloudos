import { createSignal } from "solid-js";

export interface MenuItem {
  label: string;
  icon?: string;
  action?: () => void;
  separator?: boolean;
  disabled?: boolean;
  children?: MenuItem[];
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: MenuItem[];
}

const [contextMenu, setContextMenu] = createSignal<ContextMenuState | null>(null);

export { contextMenu, setContextMenu };

export function showContextMenu(x: number, y: number, items: MenuItem[]) {
  setContextMenu({ x, y, items });
}

export function hideContextMenu() {
  setContextMenu(null);
}
