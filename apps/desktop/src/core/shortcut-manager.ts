type ShortcutHandler = () => void;

interface Shortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  handler: ShortcutHandler;
  description: string;
}

const shortcuts: Shortcut[] = [];

export function registerShortcut(shortcut: Shortcut) {
  shortcuts.push(shortcut);
}

export function initShortcuts() {
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    for (const s of shortcuts) {
      const keyMatch = e.key.toLowerCase() === s.key.toLowerCase();
      const ctrlMatch = !!s.ctrl === (e.ctrlKey || e.metaKey);
      const altMatch = !!s.alt === e.altKey;
      const shiftMatch = !!s.shift === e.shiftKey;

      if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
        e.preventDefault();
        e.stopPropagation();
        s.handler();
        return;
      }
    }
  });
}

export function getShortcuts() {
  return shortcuts;
}
