import { createSignal } from "solid-js";

/**
 * Cross-window signal so anything in the shell (Spotlight commands,
 * notifications, the Start menu, etc.) can deep-link into a specific
 * Settings page. Settings reads this on mount and on every change while
 * it's open, then clears the slot.
 *
 * The string mirrors `SettingsPage` in apps/Settings.tsx — kept loosely
 * typed here so we don't need to import that file (it's an entrypoint
 * and pulls in a lot of code).
 */
export type SettingsPageId =
  | "appearance"
  | "wallpaper"
  | "sound"
  | "account"
  | "apps"
  | "keyboard"
  | "storage"
  | "backend"
  | "about";

const [pendingSettingsPage, setPendingSettingsPage] = createSignal<SettingsPageId | null>(null);

export { pendingSettingsPage };

/** Sets the page Settings should display the next time it sees this signal. */
export function jumpToSettings(page: SettingsPageId) {
  setPendingSettingsPage(page);
}

/** Settings calls this once it has picked up the page. */
export function consumePendingSettingsPage(): SettingsPageId | null {
  const v = pendingSettingsPage();
  if (v) setPendingSettingsPage(null);
  return v;
}
