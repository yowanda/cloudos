/**
 * Editor preferences (B30 — Monaco opt-in).
 *
 * The Text Editor app supports two backends:
 *   1. The lightweight built-in `<textarea>` + `core/syntax.ts` tokenizer
 *      overlay — always available, ~5 KB, no IntelliSense.
 *   2. Microsoft Monaco — opt-in via Settings → Editor; ~3 MB lazy chunk,
 *      gives multi-cursor, find&replace UI, bracket matching, etc.
 *
 * The toggle is persisted in localStorage so reloads remember the choice.
 * Reactive changes are emitted via a Solid signal so open editor windows
 * can swap their UI without needing a full app reload.
 */

import { createSignal } from "solid-js";

const KEY = "cloudos:editor:useMonaco";

function load(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

const [useMonacoSig, setUseMonacoSig] = createSignal<boolean>(load());

/** Reactive accessor — reflects the current preference. */
export const useMonaco = useMonacoSig;

/** Update the preference and persist. */
export function setUseMonaco(next: boolean): void {
  setUseMonacoSig(next);
  if (typeof window === "undefined") return;
  try {
    if (next) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
  } catch {
    // ignore — quota / private mode
  }
}
