import { Component, Show } from "solid-js";
import { activePermissionPrompt, permissionLabel } from "../core/permissions";
import { getManifest } from "../core/app-manifest";

/**
 * Modal prompt for first-use permission requests. The actual queue +
 * resolve plumbing lives in `core/permissions.ts`; this component just
 * renders whatever is currently active (`activePermissionPrompt`) and
 * forwards the user's allow/deny choice back through the resolver.
 *
 * Mounted once at the App layer so it overlays every window. Designed to
 * look like a system-modal (centered card with backdrop) rather than a
 * window itself, since it's not part of the normal app set.
 */
const PermissionPrompt: Component = () => {
  return (
    <Show when={activePermissionPrompt()}>
      {(p) => {
        const m = () => getManifest(p().appId);
        return (
          <div
            class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cloudos-perm-title"
          >
            <div class="w-[420px] max-w-[92vw] rounded-2xl border border-white/10 bg-os-window-bg/95 p-5 shadow-2xl">
              <div class="flex items-start gap-3">
                <div class="text-3xl leading-none select-none">
                  {m()?.icon ?? "🛡️"}
                </div>
                <div class="flex-1 min-w-0">
                  <div id="cloudos-perm-title" class="text-sm font-medium text-os-text">
                    {m()?.name ?? p().appId}
                  </div>
                  <div class="text-xs text-os-text-muted mt-0.5">
                    is requesting permission to:
                  </div>
                </div>
              </div>

              <div class="mt-4 rounded-lg bg-os-bg/60 border border-white/5 p-3">
                <div class="text-sm text-os-text leading-snug">
                  {permissionLabel(p().perm)}
                </div>
                <code class="mt-1 block text-[10px] text-os-text-muted">
                  {p().perm}
                </code>
              </div>

              <p class="mt-3 text-[11px] text-os-text-muted leading-snug">
                You can change this later in <span class="text-os-text">Settings → Apps → Permissions</span>.
              </p>

              <div class="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-md border border-white/10 text-xs text-os-text hover:bg-white/5 transition-colors"
                  onClick={() => p().resolve("denied")}
                >
                  Deny
                </button>
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-md bg-os-accent text-white text-xs hover:opacity-90 transition-opacity"
                  onClick={() => p().resolve("granted")}
                >
                  Allow
                </button>
              </div>
            </div>
          </div>
        );
      }}
    </Show>
  );
};

export default PermissionPrompt;
