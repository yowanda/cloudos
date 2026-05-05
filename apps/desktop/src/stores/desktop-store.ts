import { createMemo } from "solid-js";
import { createStore, produce } from "solid-js/store";

export interface Desktop {
  id: number;
  name: string;
}

interface DesktopStore {
  desktops: Desktop[];
  currentDesktopId: number;
  switchOverlayVisible: boolean;
}

const STORAGE_KEY = "cloudos:desktops";

const defaultDesktops: Desktop[] = [
  { id: 0, name: "Desktop 1" },
  { id: 1, name: "Desktop 2" },
];

function loadInitial(): DesktopStore {
  if (typeof window === "undefined") {
    return { desktops: defaultDesktops, currentDesktopId: 0, switchOverlayVisible: false };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { desktops: defaultDesktops, currentDesktopId: 0, switchOverlayVisible: false };
    }
    const parsed = JSON.parse(raw) as { desktops?: Desktop[]; currentDesktopId?: number };
    const desktops = Array.isArray(parsed.desktops) && parsed.desktops.length > 0 ? parsed.desktops : defaultDesktops;
    const currentDesktopId = desktops.some((d) => d.id === parsed.currentDesktopId)
      ? (parsed.currentDesktopId as number)
      : desktops[0].id;
    return { desktops, currentDesktopId, switchOverlayVisible: false };
  } catch {
    return { desktops: defaultDesktops, currentDesktopId: 0, switchOverlayVisible: false };
  }
}

const [state, setState] = createStore<DesktopStore>(loadInitial());

export const desktopStore = state;
export const desktops = () => state.desktops;
export const currentDesktopId = () => state.currentDesktopId;
export const switchOverlayVisible = () => state.switchOverlayVisible;

export const currentDesktop = createMemo(
  () => state.desktops.find((d) => d.id === state.currentDesktopId) ?? state.desktops[0]
);

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ desktops: state.desktops, currentDesktopId: state.currentDesktopId })
    );
  } catch {
    // ignore quota / privacy-mode errors
  }
}

let overlayTimer: ReturnType<typeof setTimeout> | null = null;

function flashOverlay() {
  if (typeof window === "undefined") return;
  setState("switchOverlayVisible", true);
  if (overlayTimer) clearTimeout(overlayTimer);
  overlayTimer = setTimeout(() => setState("switchOverlayVisible", false), 700);
}

export function switchDesktop(id: number, opts: { silent?: boolean } = {}) {
  if (!state.desktops.some((d) => d.id === id)) return;
  if (state.currentDesktopId === id) return;
  setState("currentDesktopId", id);
  persist();
  if (!opts.silent) flashOverlay();
}

export function nextDesktop() {
  const idx = state.desktops.findIndex((d) => d.id === state.currentDesktopId);
  if (idx < 0) return;
  const next = state.desktops[(idx + 1) % state.desktops.length];
  switchDesktop(next.id);
}

export function prevDesktop() {
  const idx = state.desktops.findIndex((d) => d.id === state.currentDesktopId);
  if (idx < 0) return;
  const prev = state.desktops[(idx - 1 + state.desktops.length) % state.desktops.length];
  switchDesktop(prev.id);
}

export function addDesktop(name?: string): number {
  const nextId = state.desktops.reduce((max, d) => Math.max(max, d.id), -1) + 1;
  const desktop: Desktop = {
    id: nextId,
    name: name?.trim() || `Desktop ${state.desktops.length + 1}`,
  };
  setState(
    produce((s) => {
      s.desktops.push(desktop);
    })
  );
  persist();
  return nextId;
}

export function removeDesktop(id: number, onReassign?: (removedId: number, targetId: number) => void) {
  if (state.desktops.length <= 1) return;
  const removingCurrent = state.currentDesktopId === id;
  const remaining = state.desktops.filter((d) => d.id !== id);
  const targetId = remaining[0].id;
  setState(
    produce((s) => {
      s.desktops = remaining;
      if (removingCurrent) {
        s.currentDesktopId = targetId;
      }
    })
  );
  onReassign?.(id, targetId);
  persist();
}

export function renameDesktop(id: number, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  setState(
    produce((s) => {
      const d = s.desktops.find((d) => d.id === id);
      if (d) d.name = trimmed;
    })
  );
  persist();
}
