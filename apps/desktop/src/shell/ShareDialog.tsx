import { Component, For, Show, createMemo, createSignal } from "solid-js";
import {
  createShare,
  isExpired,
  revokeShare,
  shareUrl,
  shares,
  sharesFor,
  type SharePermission,
} from "../stores/shares-store";
import { notify } from "../stores/notification-store";

interface Props {
  filePath: string;
  fileName: string;
  onClose: () => void;
}

const expiryOptions: { label: string; days: number }[] = [
  { label: "Never", days: 0 },
  { label: "1 hour", days: 1 / 24 },
  { label: "1 day", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
];

const ShareDialog: Component<Props> = (props) => {
  const [permission, setPermission] = createSignal<SharePermission>("read");
  const [expiresInDays, setExpiresInDays] = createSignal(0);
  const [password, setPassword] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  const list = createMemo(() => {
    void shares();
    return sharesFor(props.filePath);
  });

  const create = async () => {
    setBusy(true);
    try {
      const s = await createShare({
        filePath: props.filePath,
        fileName: props.fileName,
        permission: permission(),
        expiresInDays: expiresInDays(),
        password: password() || undefined,
      });
      notify({
        title: "Share created",
        message: `${props.fileName} now shareable as ${permission()}`,
        type: "success",
        icon: "🔗",
      });
      // Auto-copy link
      try {
        await navigator.clipboard.writeText(shareUrl(s.token));
      } catch {
        // ignore
      }
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl(token));
      notify({ title: "Copied", message: "Share link copied", type: "info", icon: "📋" });
    } catch {
      notify({ title: "Copy failed", message: "Could not copy", type: "error", icon: "❌" });
    }
  };

  return (
    <div
      class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={props.onClose}
    >
      <div
        class="w-[480px] max-w-[95vw] max-h-[85vh] overflow-hidden flex flex-col bg-os-window border border-os-border rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="px-4 py-3 border-b border-os-border flex items-center gap-2">
          <span class="text-lg">🔗</span>
          <div class="flex-1">
            <h2 class="text-sm font-semibold">Share file</h2>
            <p class="text-[11px] text-os-text-muted truncate">{props.filePath}</p>
          </div>
          <button class="text-os-text-muted hover:text-os-text" onClick={props.onClose}>
            ✕
          </button>
        </div>

        <div class="p-4 space-y-3 text-xs overflow-y-auto">
          <div class="grid grid-cols-3 gap-2">
            <For each={["read", "comment", "write"] as SharePermission[]}>
              {(p) => (
                <button
                  class="px-2 py-1.5 rounded border text-center capitalize transition-colors"
                  classList={{
                    "bg-os-accent text-white border-os-accent": permission() === p,
                    "border-os-border hover:bg-os-surface-hover": permission() !== p,
                  }}
                  onClick={() => setPermission(p)}
                >
                  {p}
                </button>
              )}
            </For>
          </div>

          <label class="block">
            <span class="block text-os-text-muted mb-1">Expires in</span>
            <select
              class="w-full px-2 py-1.5 rounded bg-os-surface border border-os-border focus:outline-none focus:border-os-accent"
              value={String(expiresInDays())}
              onChange={(e) => setExpiresInDays(parseFloat(e.currentTarget.value))}
            >
              <For each={expiryOptions}>
                {(o) => <option value={String(o.days)}>{o.label}</option>}
              </For>
            </select>
          </label>

          <label class="block">
            <span class="block text-os-text-muted mb-1">Password (optional)</span>
            <input
              type="password"
              class="w-full px-2 py-1.5 rounded bg-os-surface border border-os-border focus:outline-none focus:border-os-accent"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              placeholder="Leave blank for no password"
            />
          </label>

          <button
            class="w-full px-3 py-2 rounded bg-os-accent text-white text-xs disabled:opacity-30 hover:brightness-110 transition-all"
            disabled={busy()}
            onClick={() => void create()}
          >
            {busy() ? "Creating..." : "Create share & copy link"}
          </button>

          <div class="pt-3 border-t border-os-border space-y-2">
            <h3 class="text-[11px] uppercase tracking-wide text-os-text-muted">
              Active links ({list().length})
            </h3>
            <Show
              when={list().length > 0}
              fallback={
                <p class="text-[11px] text-os-text-muted">No active shares for this file.</p>
              }
            >
              <For each={list()}>
                {(s) => (
                  <div
                    class="p-2 rounded border border-os-border space-y-1"
                    classList={{ "opacity-60": isExpired(s) }}
                  >
                    <div class="flex items-center gap-2 text-[11px]">
                      <span class="px-1.5 py-0.5 rounded bg-os-accent/15 text-os-accent capitalize">
                        {s.permission}
                      </span>
                      <Show when={s.passwordHash}>
                        <span class="px-1.5 py-0.5 rounded bg-os-warning/20 text-os-warning">
                          🔒 password
                        </span>
                      </Show>
                      <Show when={isExpired(s)}>
                        <span class="px-1.5 py-0.5 rounded bg-os-danger/20 text-os-danger">
                          expired
                        </span>
                      </Show>
                      <span class="ml-auto text-os-text-muted">
                        {s.expiresAt
                          ? `expires ${new Date(s.expiresAt).toLocaleDateString()}`
                          : "never expires"}
                      </span>
                    </div>
                    <div class="flex items-center gap-1">
                      <input
                        type="text"
                        readOnly
                        value={shareUrl(s.token)}
                        class="flex-1 px-2 py-1 text-[10px] rounded bg-os-surface border border-os-border font-mono truncate"
                      />
                      <button
                        class="px-2 py-1 rounded bg-os-surface border border-os-border hover:bg-os-surface-hover"
                        onClick={() => void copyLink(s.token)}
                      >
                        Copy
                      </button>
                      <button
                        class="px-2 py-1 rounded bg-os-danger text-white hover:brightness-110"
                        onClick={() => revokeShare(s.id)}
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareDialog;
