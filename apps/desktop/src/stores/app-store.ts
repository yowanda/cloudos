import { createStore } from "solid-js/store";
import type { InstalledApp } from "@cloudos/shared";

interface AppStoreState {
  installedApps: InstalledApp[];
  runningAppIds: string[];
}

const [state, setState] = createStore<AppStoreState>({
  installedApps: [],
  runningAppIds: [],
});

export const appStore = state;

export function registerApp(app: InstalledApp) {
  setState("installedApps", (apps) => [...apps, app]);
}

export function markRunning(appId: string) {
  setState("runningAppIds", (ids) => [...new Set([...ids, appId])]);
}

export function markStopped(appId: string) {
  setState("runningAppIds", (ids) => ids.filter((id) => id !== appId));
}
