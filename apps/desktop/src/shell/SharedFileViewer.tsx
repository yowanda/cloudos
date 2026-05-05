import { Component, Show, createMemo, createSignal } from "solid-js";
import { findShareByToken, isExpired, verifySharePassword } from "../stores/shares-store";
import { getEntry } from "../vfs/vfs";

interface Props {
  token: string;
  onDismiss: () => void;
}

const SharedFileViewer: Component<Props> = (props) => {
  const [password, setPassword] = createSignal("");
  const [unlocked, setUnlocked] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const share = createMemo(() => findShareByToken(props.token));
  const entry = createMemo(() => {
    const s = share();
    return s ? getEntry(s.filePath) : undefined;
  });
  const expired = () => {
    const s = share();
    return s ? isExpired(s) : false;
  };

  const tryUnlock = async () => {
    const ok = await verifySharePassword(props.token, password());
    if (ok) {
      setUnlocked(true);
      setError(null);
    } else {
      setError("Wrong password");
    }
  };

  // Auto-unlock if no password set
  if (share() && !share()!.passwordHash) {
    setUnlocked(true);
  }

  return (
    <div class="fixed inset-0 z-[10001] bg-os-bg flex items-center justify-center p-4">
      <div class="w-[640px] max-w-[95vw] max-h-[90vh] flex flex-col bg-os-window border border-os-border rounded-2xl shadow-2xl overflow-hidden">
        <div class="px-4 py-3 border-b border-os-border flex items-center gap-2">
          <span class="text-lg">🔗</span>
          <div class="flex-1">
            <h1 class="text-sm font-semibold">Shared file</h1>
            <Show when={share()} fallback={<p class="text-[11px] text-os-text-muted">Invalid or revoked link</p>}>
              {(s) => <p class="text-[11px] text-os-text-muted truncate">{s().fileName}</p>}
            </Show>
          </div>
          <button
            class="text-[11px] px-2 py-1 rounded bg-os-surface border border-os-border hover:bg-os-surface-hover"
            onClick={props.onDismiss}
          >
            Open CloudOS
          </button>
        </div>

        <div class="p-4 flex-1 overflow-auto">
          <Show
            when={share()}
            fallback={
              <div class="text-os-text-muted text-sm text-center py-12">
                This share link is not valid in your local browser. (Local share links are stored
                per-browser; if the share was created elsewhere, sign in to view it.)
              </div>
            }
          >
            {(s) => (
              <Show
                when={!expired()}
                fallback={
                  <div class="text-os-danger text-sm text-center py-12">
                    This link expired on {new Date(s().expiresAt!).toLocaleString()}.
                  </div>
                }
              >
                <Show
                  when={unlocked()}
                  fallback={
                    <div class="space-y-3 max-w-sm mx-auto py-8">
                      <p class="text-xs text-os-text-muted text-center">
                        🔒 This link is password-protected.
                      </p>
                      <input
                        type="password"
                        autofocus
                        class="w-full px-3 py-2 rounded bg-os-surface border border-os-border focus:outline-none focus:border-os-accent"
                        value={password()}
                        onInput={(e) => setPassword(e.currentTarget.value)}
                        onKeyDown={(e) => e.key === "Enter" && void tryUnlock()}
                        placeholder="Password"
                      />
                      <Show when={error()}>
                        <p class="text-os-danger text-xs">{error()}</p>
                      </Show>
                      <button
                        class="w-full px-3 py-2 rounded bg-os-accent text-white"
                        onClick={() => void tryUnlock()}
                      >
                        Unlock
                      </button>
                    </div>
                  }
                >
                  <Show
                    when={entry()}
                    fallback={
                      <div class="text-os-text-muted text-sm text-center py-12">
                        File no longer exists at <code>{s().filePath}</code>.
                      </div>
                    }
                  >
                    {(f) => (
                      <div class="space-y-3">
                        <div class="flex items-center gap-2 text-[11px] text-os-text-muted">
                          <span class="px-2 py-0.5 rounded bg-os-accent/15 text-os-accent capitalize">
                            {s().permission}
                          </span>
                          <span>{f().size} bytes</span>
                          <span>·</span>
                          <span>{f().mimeType}</span>
                        </div>
                        <pre class="text-xs whitespace-pre-wrap break-words bg-os-surface border border-os-border rounded p-3 max-h-[60vh] overflow-auto">
                          {f().content ?? "(no content)"}
                        </pre>
                      </div>
                    )}
                  </Show>
                </Show>
              </Show>
            )}
          </Show>
        </div>
      </div>
    </div>
  );
};

export default SharedFileViewer;
