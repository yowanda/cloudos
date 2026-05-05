import type { Component } from "solid-js";

type AppComponent = Component<{ windowId: string }>;

const registry = new Map<string, AppComponent>();

export function registerAppComponent(appId: string, component: AppComponent) {
  registry.set(appId, component);
}

export function getAppComponent(appId: string): AppComponent | undefined {
  return registry.get(appId);
}
