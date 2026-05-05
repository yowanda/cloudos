export type AppType = "native" | "sandboxed";

export interface AppWindowConfig {
  width: number;
  height: number;
  resizable: boolean;
  minWidth: number;
  minHeight: number;
}

export interface AppManifest {
  id: string;
  name: string;
  version: string;
  icon: string;
  entry: string;
  type: AppType;
  window: AppWindowConfig;
  permissions: string[];
  categories: string[];
  author: string;
  description: string;
}

export interface InstalledApp extends AppManifest {
  pinned: boolean;
  dockPosition: number;
}
