export type WindowState = "normal" | "minimized" | "maximized" | "snapped";

export type SnapZone =
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowConfig {
  id: string;
  appId: string;
  title: string;
  icon: string;
  state: WindowState;
  bounds: WindowBounds;
  prevBounds: WindowBounds | null;
  zIndex: number;
  desktopId: number;
  snapZone: SnapZone | null;
  resizable: boolean;
  draggable: boolean;
  closable: boolean;
  minimizable: boolean;
  maximizable: boolean;
  minWidth: number;
  minHeight: number;
  focused: boolean;
}
