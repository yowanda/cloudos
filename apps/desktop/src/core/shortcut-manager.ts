type ShortcutHandler = () => void;

export interface ShortcutBinding {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export interface Shortcut extends ShortcutBinding {
  /** Stable identifier; defaults to description if not provided. */
  id?: string;
  /** When true the shortcut cannot be remapped from UI. */
  locked?: boolean;
  handler: ShortcutHandler;
  description: string;
}

interface StoredOverride extends ShortcutBinding {}

const STORAGE_KEY = "cloudos:shortcuts";
const shortcuts: Shortcut[] = [];
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const fn of listeners) fn();
}

export function subscribeShortcuts(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function loadOverrides(): Record<string, StoredOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, StoredOverride>;
  } catch {
    return {};
  }
}

function saveOverrides(map: Record<string, StoredOverride>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function shortcutId(s: Shortcut): string {
  return s.id ?? s.description;
}

export function registerShortcut(shortcut: Shortcut) {
  shortcuts.push(shortcut);
}

function effectiveBinding(s: Shortcut): ShortcutBinding {
  if (s.locked) {
    return { key: s.key, ctrl: s.ctrl, alt: s.alt, shift: s.shift, meta: s.meta };
  }
  const overrides = loadOverrides();
  const o = overrides[shortcutId(s)];
  if (o && o.key) return o;
  return { key: s.key, ctrl: s.ctrl, alt: s.alt, shift: s.shift, meta: s.meta };
}

export function initShortcuts() {
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    for (const s of shortcuts) {
      const b = effectiveBinding(s);
      const keyMatch = e.key.toLowerCase() === b.key.toLowerCase();
      const ctrlMatch = !!b.ctrl === (e.ctrlKey || e.metaKey);
      const altMatch = !!b.alt === e.altKey;
      const shiftMatch = !!b.shift === e.shiftKey;

      if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
        e.preventDefault();
        e.stopPropagation();
        s.handler();
        return;
      }
    }
  });
}

export function getShortcuts(): Shortcut[] {
  return shortcuts;
}

export interface ShortcutView {
  id: string;
  description: string;
  locked: boolean;
  current: ShortcutBinding;
  defaults: ShortcutBinding;
  isCustom: boolean;
}

export function listShortcuts(): ShortcutView[] {
  const overrides = loadOverrides();
  return shortcuts.map((s) => {
    const id = shortcutId(s);
    const defaults: ShortcutBinding = {
      key: s.key,
      ctrl: s.ctrl,
      alt: s.alt,
      shift: s.shift,
      meta: s.meta,
    };
    const o = overrides[id];
    const current: ShortcutBinding = s.locked ? defaults : (o && o.key ? o : defaults);
    return {
      id,
      description: s.description,
      locked: !!s.locked,
      current,
      defaults,
      isCustom: !s.locked && !!o && o.key !== undefined && bindingsDiffer(current, defaults),
    };
  });
}

function bindingsDiffer(a: ShortcutBinding, b: ShortcutBinding): boolean {
  return (
    a.key.toLowerCase() !== b.key.toLowerCase() ||
    !!a.ctrl !== !!b.ctrl ||
    !!a.alt !== !!b.alt ||
    !!a.shift !== !!b.shift ||
    !!a.meta !== !!b.meta
  );
}

export interface SetBindingResult {
  ok: boolean;
  reason?: "locked" | "duplicate" | "invalid";
  conflict?: string;
}

export function setShortcutBinding(id: string, binding: ShortcutBinding): SetBindingResult {
  const target = shortcuts.find((s) => shortcutId(s) === id);
  if (!target) return { ok: false, reason: "invalid" };
  if (target.locked) return { ok: false, reason: "locked" };
  if (!binding.key) return { ok: false, reason: "invalid" };

  // Check for duplicates against effective bindings of other shortcuts
  for (const s of shortcuts) {
    if (shortcutId(s) === id) continue;
    const b = effectiveBinding(s);
    if (
      b.key.toLowerCase() === binding.key.toLowerCase() &&
      !!b.ctrl === !!binding.ctrl &&
      !!b.alt === !!binding.alt &&
      !!b.shift === !!binding.shift &&
      !!b.meta === !!binding.meta
    ) {
      return { ok: false, reason: "duplicate", conflict: s.description };
    }
  }

  const map = loadOverrides();
  map[id] = {
    key: binding.key,
    ctrl: !!binding.ctrl,
    alt: !!binding.alt,
    shift: !!binding.shift,
    meta: !!binding.meta,
  };
  saveOverrides(map);
  notifyListeners();
  return { ok: true };
}

export function resetShortcut(id: string) {
  const map = loadOverrides();
  if (id in map) {
    delete map[id];
    saveOverrides(map);
    notifyListeners();
  }
}

export function resetAllShortcuts() {
  saveOverrides({});
  notifyListeners();
}

export function formatBinding(b: ShortcutBinding): string {
  const parts: string[] = [];
  if (b.ctrl) parts.push("Ctrl");
  if (b.alt) parts.push("Alt");
  if (b.shift) parts.push("Shift");
  if (b.meta) parts.push("Meta");
  parts.push(prettyKey(b.key));
  return parts.join(" + ");
}

function prettyKey(k: string): string {
  switch (k) {
    case " ":
      return "Space";
    case "ArrowUp":
      return "↑";
    case "ArrowDown":
      return "↓";
    case "ArrowLeft":
      return "←";
    case "ArrowRight":
      return "→";
    case "Escape":
      return "Esc";
    case "Tab":
      return "Tab";
    case "Enter":
      return "Enter";
    case "Backspace":
      return "Backspace";
    case "Meta":
      return "Meta";
    default:
      return k.length === 1 ? k.toUpperCase() : k;
  }
}
