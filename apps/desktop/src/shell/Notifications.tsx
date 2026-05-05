import { Component, For, Show, createMemo } from "solid-js";
import {
  toasts,
  notifications,
  showNotificationCenter,
  setShowNotificationCenter,
  dismissToast,
  markRead,
  markAllRead,
  clearNotifications,
} from "../stores/notification-store";

const typeColors: Record<string, string> = {
  info: "border-l-blue-400",
  success: "border-l-green-400",
  warning: "border-l-yellow-400",
  error: "border-l-red-400",
};

const typeIcons: Record<string, string> = {
  info: "ℹ️",
  success: "✓",
  warning: "⚠️",
  error: "✕",
};

export const ToastLayer: Component = () => {
  return (
    <div class="fixed top-12 right-3 z-[99980] flex flex-col gap-2 max-w-xs pointer-events-none">
      <For each={toasts}>
        {(toast) => (
          <div
            class={`pointer-events-auto flex items-start gap-2 p-3 rounded-xl bg-os-window border border-os-border border-l-4 ${typeColors[toast.type]} shadow-2xl backdrop-blur-xl animate-slide-in text-xs cursor-pointer`}
            onClick={() => dismissToast(toast.id)}
          >
            <span class="text-sm mt-0.5">{toast.icon ?? typeIcons[toast.type]}</span>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-os-text truncate">{toast.title}</p>
              <p class="text-os-text-muted mt-0.5 line-clamp-2">{toast.message}</p>
            </div>
          </div>
        )}
      </For>
    </div>
  );
};

export const NotificationCenter: Component = () => {
  const sortedNotifications = createMemo(() =>
    [...notifications].sort((a, b) => b.timestamp - a.timestamp)
  );

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <Show when={showNotificationCenter()}>
      {/* Backdrop */}
      <div
        class="fixed inset-0 z-[9996]"
        onClick={() => setShowNotificationCenter(false)}
      />

      <div class="fixed top-10 right-2 z-[9997] w-80 max-h-[500px] flex flex-col rounded-2xl bg-os-window border border-os-border shadow-2xl backdrop-blur-xl overflow-hidden">
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-2.5 border-b border-os-border">
          <span class="text-xs font-semibold text-os-text">Notifications</span>
          <div class="flex gap-2">
            <button
              class="text-[10px] text-os-accent hover:text-os-accent-hover transition-colors"
              onClick={markAllRead}
            >
              Mark all read
            </button>
            <button
              class="text-[10px] text-os-text-muted hover:text-os-text transition-colors"
              onClick={clearNotifications}
            >
              Clear
            </button>
          </div>
        </div>

        {/* List */}
        <div class="flex-1 overflow-y-auto">
          <Show
            when={sortedNotifications().length > 0}
            fallback={
              <div class="flex flex-col items-center justify-center py-10 text-os-text-muted text-xs">
                <span class="text-2xl mb-2">🔔</span>
                <p>No notifications</p>
              </div>
            }
          >
            <For each={sortedNotifications()}>
              {(notif) => (
                <div
                  class="flex items-start gap-2 px-4 py-3 border-b border-os-border/50 cursor-pointer hover:bg-os-surface-hover transition-colors"
                  classList={{ "opacity-50": notif.read }}
                  onClick={() => markRead(notif.id)}
                >
                  <span class="text-sm mt-0.5">
                    {notif.icon ?? typeIcons[notif.type]}
                  </span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <p class="text-xs font-medium text-os-text truncate">{notif.title}</p>
                      {!notif.read && (
                        <div class="w-1.5 h-1.5 rounded-full bg-os-accent flex-shrink-0" />
                      )}
                    </div>
                    <p class="text-[11px] text-os-text-muted mt-0.5">{notif.message}</p>
                    <p class="text-[10px] text-os-text-muted/50 mt-1">{formatTime(notif.timestamp)}</p>
                  </div>
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>
    </Show>
  );
};
