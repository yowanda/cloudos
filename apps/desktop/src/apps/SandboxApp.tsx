import { Component, Show, createMemo, onCleanup, onMount } from "solid-js";
import {
  getManifest,
  manifestsVersion,
  type AppManifest,
} from "../core/app-manifest";
import { attachSandbox, SDK_BOOTSTRAP } from "../core/sandbox-bridge";

interface Props {
  manifestId: string;
  windowId: string;
}

function buildSrcDoc(manifest: AppManifest): string {
  const entry = manifest.entry;
  if (entry.type === "iframe") {
    const userHtml = entry.html;
    // Inject SDK after <head> or prepend to body
    if (/<head>/i.test(userHtml)) {
      return userHtml.replace(/<head>/i, `<head>${SDK_BOOTSTRAP}`);
    }
    return `<!doctype html><html><head><meta charset="utf-8">${SDK_BOOTSTRAP}</head><body>${userHtml}</body></html>`;
  }
  return "";
}

const SandboxApp: Component<Props> = (props) => {
  let iframeEl: HTMLIFrameElement | undefined;
  let detach: (() => void) | undefined;

  const manifest = createMemo<AppManifest | undefined>(() => {
    void manifestsVersion();
    return getManifest(props.manifestId);
  });

  onMount(() => {
    if (!iframeEl) return;
    const m = manifest();
    if (!m) return;
    detach = attachSandbox(iframeEl, { manifest: m, windowId: props.windowId });
  });

  onCleanup(() => {
    detach?.();
  });

  return (
    <Show
      when={manifest()}
      fallback={
        <div class="p-4 text-os-text-muted text-sm">
          Manifest <code>{props.manifestId}</code> not installed.
        </div>
      }
    >
      {(m) => {
        const e = m().entry;
        if (e.type === "iframe-url") {
          return (
            <iframe
              ref={(el) => (iframeEl = el)}
              src={e.url}
              sandbox="allow-scripts allow-forms allow-same-origin"
              class="w-full h-full bg-white border-0"
              title={m().name}
            />
          );
        }
        if (e.type === "iframe") {
          return (
            <iframe
              ref={(el) => (iframeEl = el)}
              srcdoc={buildSrcDoc(m())}
              sandbox="allow-scripts"
              class="w-full h-full bg-white border-0"
              title={m().name}
            />
          );
        }
        return (
          <div class="p-4 text-os-text-muted text-sm">
            App entry type "{(e as { type: string }).type}" cannot be rendered as a sandbox.
          </div>
        );
      }}
    </Show>
  );
};

export default SandboxApp;
