import { createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";

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
}

const [notifications, setNotifications] = createStore<Notification[]>([]);
const [toasts, setToasts] = createStore<Notification[]>([]);
const [showNotificationCenter, setShowNotificationCenter] = createSignal(false);

let nextId = 0;

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

  if (notification.duration && notification.duration > 0) {
    setTimeout(() => dismissToast(notification.id), notification.duration);
  }
}

export function dismissToast(id: string) {
  setToasts((t) => t.filter((n) => n.id !== id));
}

export function markRead(id: string) {
  setNotifications(
    (n) => n.id === id,
    "read",
    true,
  );
}

export function markAllRead() {
  setNotifications({}, "read" as any, true as any);
}

export function clearNotifications() {
  setNotifications([]);
}

export function toggleNotificationCenter() {
  setShowNotificationCenter((v) => !v);
}

export function unreadCount() {
  return notifications.filter((n) => !n.read).length;
}

export { notifications, toasts, showNotificationCenter, setShowNotificationCenter };
