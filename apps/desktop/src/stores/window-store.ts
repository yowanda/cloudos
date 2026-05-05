import { createStore, produce } from "solid-js/store";
import type { WindowConfig, WindowState, SnapZone, WindowBounds } from "@cloudos/shared";
import { generateId } from "@cloudos/shared";
import { currentDesktopId } from "./desktop-store";

interface WindowStore {
  windows: WindowConfig[];
  topZIndex: number;
}

const [state, setState] = createStore<WindowStore>({
  windows: [],
  topZIndex: 100,
});

export const windowStore = state;

export function currentDesktopWindows() {
  const did = currentDesktopId();
  return state.windows.filter((w) => w.desktopId === did);
}

export function openWindow(opts: {
  appId: string;
  title: string;
  icon: string;
  width?: number;
  height?: number;
  resizable?: boolean;
  minWidth?: number;
  minHeight?: number;
}) {
  const id = generateId("win");
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = opts.width ?? 800;
  const h = opts.height ?? 600;

  const newWindow: WindowConfig = {
    id,
    appId: opts.appId,
    title: opts.title,
    icon: opts.icon,
    state: "normal",
    bounds: {
      x: Math.max(40, (vw - w) / 2 + Math.random() * 60 - 30),
      y: Math.max(40, (vh - h) / 2 + Math.random() * 60 - 30),
      width: w,
      height: h,
    },
    prevBounds: null,
    zIndex: state.topZIndex + 1,
    desktopId: currentDesktopId(),
    snapZone: null,
    resizable: opts.resizable ?? true,
    draggable: true,
    closable: true,
    minimizable: true,
    maximizable: true,
    minWidth: opts.minWidth ?? 200,
    minHeight: opts.minHeight ?? 150,
    focused: true,
  };

  setState(
    produce((s) => {
      s.windows.forEach((w) => (w.focused = false));
      s.windows.push(newWindow);
      s.topZIndex += 1;
    })
  );

  return id;
}

export function closeWindow(id: string) {
  setState(
    produce((s) => {
      s.windows = s.windows.filter((w) => w.id !== id);
    })
  );
}

export function focusWindow(id: string) {
  setState(
    produce((s) => {
      s.topZIndex += 1;
      s.windows.forEach((w) => {
        w.focused = w.id === id;
        if (w.id === id) {
          w.zIndex = s.topZIndex;
          if (w.state === "minimized") w.state = "normal";
        }
      });
    })
  );
}

export function minimizeWindow(id: string) {
  setState(
    produce((s) => {
      const w = s.windows.find((w) => w.id === id);
      if (w) {
        w.state = "minimized";
        w.focused = false;
      }
    })
  );
}

export function maximizeWindow(id: string) {
  setState(
    produce((s) => {
      const w = s.windows.find((w) => w.id === id);
      if (!w) return;
      if (w.state === "maximized") {
        w.state = "normal";
        if (w.prevBounds) {
          w.bounds = { ...w.prevBounds };
          w.prevBounds = null;
        }
      } else {
        w.prevBounds = { ...w.bounds };
        w.state = "maximized";
        w.bounds = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight - 88 };
        w.snapZone = null;
      }
    })
  );
}

export function snapWindow(id: string, zone: SnapZone) {
  const vw = window.innerWidth;
  const vh = window.innerHeight - 88;

  const snapBounds: Record<SnapZone, WindowBounds> = {
    left: { x: 0, y: 0, width: vw / 2, height: vh },
    right: { x: vw / 2, y: 0, width: vw / 2, height: vh },
    "top-left": { x: 0, y: 0, width: vw / 2, height: vh / 2 },
    "top-right": { x: vw / 2, y: 0, width: vw / 2, height: vh / 2 },
    "bottom-left": { x: 0, y: vh / 2, width: vw / 2, height: vh / 2 },
    "bottom-right": { x: vw / 2, y: vh / 2, width: vw / 2, height: vh / 2 },
  };

  setState(
    produce((s) => {
      const w = s.windows.find((w) => w.id === id);
      if (!w) return;
      if (w.state !== "snapped") w.prevBounds = { ...w.bounds };
      w.state = "snapped";
      w.snapZone = zone;
      w.bounds = snapBounds[zone];
    })
  );
}

export function moveWindow(id: string, x: number, y: number) {
  setState(
    produce((s) => {
      const w = s.windows.find((w) => w.id === id);
      if (!w) return;
      if (w.state === "maximized" || w.state === "snapped") {
        if (w.prevBounds) {
          w.bounds.width = w.prevBounds.width;
          w.bounds.height = w.prevBounds.height;
          w.prevBounds = null;
        }
        w.state = "normal";
        w.snapZone = null;
      }
      w.bounds.x = x;
      w.bounds.y = y;
    })
  );
}

export function resizeWindow(id: string, bounds: Partial<WindowBounds>) {
  setState(
    produce((s) => {
      const w = s.windows.find((w) => w.id === id);
      if (!w) return;
      if (bounds.x !== undefined) w.bounds.x = bounds.x;
      if (bounds.y !== undefined) w.bounds.y = bounds.y;
      if (bounds.width !== undefined) w.bounds.width = Math.max(bounds.width, w.minWidth);
      if (bounds.height !== undefined) w.bounds.height = Math.max(bounds.height, w.minHeight);
    })
  );
}

export function getWindowsByDesktop(desktopId: number) {
  return state.windows.filter((w) => w.desktopId === desktopId);
}

export function moveWindowToDesktop(id: string, desktopId: number) {
  setState(
    produce((s) => {
      const w = s.windows.find((w) => w.id === id);
      if (!w) return;
      w.desktopId = desktopId;
      w.focused = false;
    })
  );
}

export function reassignWindowsFromDesktop(removedDesktopId: number, targetDesktopId: number) {
  if (removedDesktopId === targetDesktopId) return;
  setState(
    produce((s) => {
      for (const w of s.windows) {
        if (w.desktopId === removedDesktopId) w.desktopId = targetDesktopId;
      }
    })
  );
}
