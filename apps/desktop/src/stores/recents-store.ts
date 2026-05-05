import { createSignal } from "solid-js";

const STORAGE_KEY = "cloudos:recent-apps";
const MAX_RECENTS = 6;

function loadInitial(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

const [recentApps, setRecentApps] = createSignal<string[]>(loadInitial());

function persist(list: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // localStorage unavailable; silently ignore
  }
}

/** Record the most-recent launch of an app id; deduplicates and bounds the list. */
export function recordRecent(appId: string) {
  setRecentApps((prev) => {
    const filtered = prev.filter((id) => id !== appId);
    const next = [appId, ...filtered].slice(0, MAX_RECENTS);
    persist(next);
    return next;
  });
}

/** Clear the recent-app history (used by Settings → Apps). */
export function clearRecents() {
  setRecentApps([]);
  persist([]);
}

export { recentApps };
