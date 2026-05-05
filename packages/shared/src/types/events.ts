export type EventType =
  | "window:open"
  | "window:close"
  | "window:focus"
  | "window:minimize"
  | "window:maximize"
  | "window:restore"
  | "window:snap"
  | "window:move"
  | "window:resize"
  | "app:launch"
  | "app:terminate"
  | "desktop:switch"
  | "theme:change"
  | "notification:show"
  | "notification:dismiss"
  | "contextmenu:show"
  | "contextmenu:hide"
  | "startmenu:toggle";

export interface OSEvent<T = unknown> {
  type: EventType;
  payload: T;
  timestamp: number;
}
