import { createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { playSound } from "../core/sound-manager";
import { openWindow as _openWindow } from "./window-store";

/**
 * Action button shown on a toast and in the Notification Center.
 *
 * `kind` is purely cosmetic. `dismissOnRun` defaults to true — most
 * actions (open, accept, reply…) want to clear the toast as soon as the
 * user has acted on them. Set it to false for actions that are
 * expected to leave the notification visible (rare).
 */
export interface NotificationAction {
  id: string;
  label: string;
  icon?: string;
  kind?: "default" | "primary" | "danger";
  run: () => void | Promise<void>;
  /** If true (default), dismiss the toast and mark read after `run()`. */
  dismissOnRun?: boolean;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  icon?: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: number;
  read: boolean;
  appId?: string;
  duration?: number;
  /** Optional action buttons. Limit to ~3 per notification for layout. */
  actions?: NotificationAction[];
  /** When set, the notification is hidden from the center + toast list
   *  until `Date.now() >= snoozedUntil`. A timer re-emits a toast at
   *  that point. See `snoozeNotification()`. */
  snoozedUntil?: number;
}

const [notifications, setNotifications] = createStore<Notification[]>([]);
const [toasts, setToasts] = createStore<Notification[]>([]);
const [showNotificationCenter, setShowNotificationCenter] = createSignal(false);

let nextId = 0;

// Active snooze timers. Keyed by notification id so we can cancel on
// "wake now" or repeat-snooze without leaking timers.
const snoozeTimers = new Map<string, ReturnType<typeof setTimeout>>();

function playSoundForType(type: Notification["type"]) {
  switch (type) {
    case "success": playSound("success"); break;
    case "warning": playSound("warning"); break;
    case "error":   playSound("error");   break;
    default:        playSound("notify");
  }
}

export function notify(opts: Omit<Notification, "id" | "timestamp" | "read">) {
  const notification: Notification = {
    id: `notif-${++nextId}`,
    timestamp: Date.now(),
    read: false,
    duration: opts.duration ?? 4000,
    ...opts,
  };

  setNotifications(produce((n) => n.unshift(notification)));
  setToasts(produce((t) => t.push(notification)));
  playSoundForType(notification.type);

  // Toasts with action buttons stay visible by default — the user is
  // expected to interact with them. Plain notifications still auto-dismiss.
  const wantsAutoDismiss = (notification.duration ?? 0) > 0 && (notification.actions?.length ?? 0) === 0;
  if (wantsAutoDismiss) {
    setTimeout(() => dismissToast(notification.id), notification.duration);
  }
}

export function dismissToast(id: string) {
  setToasts((t) => t.filter((n) => n.id !== id));
}

export function markRead(id: string) {
  setNotifications((n) => n.id === id, "read", true);
}

export function markAllRead() {
  setNotifications({}, "read" as never, true as never);
}

export function clearNotifications() {
  // Tear down any pending snooze timers so we don't fire on cleared items.
  for (const [, t] of snoozeTimers) clearTimeout(t);
  snoozeTimers.clear();
  setNotifications([]);
  setToasts([]);
}

export function toggleNotificationCenter() {
  setShowNotificationCenter((v) => !v);
}

export function unreadCount() {
  // Snoozed items don't contribute to the unread badge.
  const now = Date.now();
  return notifications.filter((n) => !n.read && (n.snoozedUntil ?? 0) <= now).length;
}

/**
 * Snooze a notification: hide its toast, mark it as snoozed (so the
 * Notification Center shows a "💤 snoozed for X" pill), and schedule
 * a re-toast for `ms` from now. Called by the built-in `snoozeAction`
 * helper, but exposed for custom UIs that want to add their own snooze
 * affordances.
 */
export function snoozeNotification(id: string, ms: number) {
  const wakeAt = Date.now() + ms;
  const old = snoozeTimers.get(id);
  if (old) clearTimeout(old);

  setNotifications((n) => n.id === id, "snoozedUntil", wakeAt);
  dismissToast(id);

  const t = setTimeout(() => {
    snoozeTimers.delete(id);
    const cur = notifications.find((n) => n.id === id);
    if (!cur) return;
    setNotifications(
      (n) => n.id === id,
      produce((n) => {
        n.snoozedUntil = undefined;
        n.read = false;
        n.timestamp = Date.now();
      }),
    );
    setToasts(produce((arr) => arr.push({ ...cur, snoozedUntil: undefined, read: false, timestamp: Date.now() })));
    playSoundForType(cur.type);
  }, ms);
  snoozeTimers.set(id, t);
}

/** Cancel a snooze and immediately re-toast the notification. */
export function wakeNotification(id: string) {
  const t = snoozeTimers.get(id);
  if (t) {
    clearTimeout(t);
    snoozeTimers.delete(id);
  }
  const cur = notifications.find((n) => n.id === id);
  if (!cur) return;
  setNotifications(
    (n) => n.id === id,
    produce((n) => {
      n.snoozedUntil = undefined;
      n.read = false;
      n.timestamp = Date.now();
    }),
  );
  setToasts(produce((arr) => arr.push({ ...cur, snoozedUntil: undefined, read: false, timestamp: Date.now() })));
}

/**
 * Run an action and apply its dismiss policy. Centralised here so both
 * the toast and the center share the same behaviour.
 */
export async function runAction(notifId: string, action: NotificationAction) {
  try {
    await action.run();
  } catch (err) {
    // Surface the error as its own notification so users see it instead
    // of a swallowed console error.
    notify({
      title: `Action failed`,
      message: err instanceof Error ? err.message : String(err),
      type: "error",
      icon: "⚠️",
    });
  }
  if (action.dismissOnRun !== false) {
    dismissToast(notifId);
    markRead(notifId);
  }
}

// ─── Built-in action helpers ─────────────────────────────────────────────

/** Standard "Dismiss" button — closes the toast and marks read. */
export function dismissAction(label = "Dismiss"): NotificationAction {
  return {
    id: "dismiss",
    label,
    kind: "default",
    run: () => {
      // No-op: `runAction` will dismiss because dismissOnRun !== false.
    },
  };
}

/**
 * Standard "Snooze N minutes" button. The default 5-minute snooze is
 * what most platform notification UIs use for casual reminders.
 */
export function snoozeAction(ms = 5 * 60_000, label?: string): NotificationAction {
  const minutes = Math.round(ms / 60_000);
  return {
    id: `snooze-${ms}`,
    label: label ?? `Snooze ${minutes}m`,
    icon: "💤",
    kind: "default",
    dismissOnRun: false, // snoozeNotification handles the dismiss itself
    run: () => snoozeWithThis(ms),
  };

  // Helper closure so each action knows which notification it belongs to
  // — set via the `_notifId` symbol below in renderActionList. We can't
  // capture the id at action-creation time because helpers are reused
  // across notifications.
  function snoozeWithThis(ms: number) {
    const id = currentActionContextId;
    if (id) snoozeNotification(id, ms);
  }
}

/** Opens an app window via `openWindow` from the window store. */
export function openAppAction(appId: string, title: string, icon: string, label = "Open"): NotificationAction {
  return {
    id: `open-${appId}`,
    label,
    icon,
    kind: "primary",
    run: () => {
      _openWindow({ appId, title, icon, width: 720, height: 480 });
    },
  };
}

// Internal context: set by the renderer for the duration of a single
// `runAction` so that helpers like `snoozeAction()` can capture the
// notification id without needing the caller to thread it through.
let currentActionContextId: string | null = null;
export function withActionContext<T>(notifId: string, fn: () => T): T {
  const prev = currentActionContextId;
  currentActionContextId = notifId;
  try {
    return fn();
  } finally {
    currentActionContextId = prev;
  }
}

export {
  notifications,
  toasts,
  showNotificationCenter,
  setShowNotificationCenter,
};
