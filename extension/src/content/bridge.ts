// Content script injected into the configured CloudOS origin. It bridges
// `window.postMessage` requests from CloudOS into `chrome.runtime` calls so
// the in-app `/recent` slash command (or any future feature) can read the
// browser history when running inside this extension.
//
// Security: we only accept messages where `event.source === window` and the
// origin matches the current document. The service worker performs an extra
// origin-equality check against the saved settings before answering.

import type { ExtensionRequest, ExtensionResponse } from "../shared/messages";

const KNOWN_REQUEST_TYPES = new Set<ExtensionRequest["type"]>([
  "cloudos:ext:get-history",
  "cloudos:ext:ping",
]);

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;
  const data = event.data;
  if (!data || typeof data !== "object") return;
  const type = (data as { type?: unknown }).type;
  if (typeof type !== "string" || !KNOWN_REQUEST_TYPES.has(type as ExtensionRequest["type"])) {
    return;
  }
  void forward(data as ExtensionRequest);
});

async function forward(request: ExtensionRequest): Promise<void> {
  try {
    const response = (await chrome.runtime.sendMessage(request)) as ExtensionResponse | undefined;
    if (!response) return;
    window.postMessage(response, window.location.origin);
  } catch (err) {
    window.postMessage(
      {
        type: "cloudos:ext:get-history:result",
        id: request.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      window.location.origin,
    );
  }
}

// Announce ourselves so CloudOS pages can detect the extension synchronously
// without having to round-trip a ping. A custom event is namespaced on a
// detail object instead of leaking properties onto `window`.
window.dispatchEvent(
  new CustomEvent("cloudos:ext:ready", {
    detail: { version: chrome.runtime.getManifest().version },
  }),
);
