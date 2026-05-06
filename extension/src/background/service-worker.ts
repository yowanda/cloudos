// Background service worker for the CloudOS extension. MV3 service workers
// are short-lived event handlers — never store mutable state at module scope
// without persisting it via `chrome.storage.*`.

import type {
  ExtensionRequest,
  ExtensionResponse,
  GetHistoryError,
  GetHistoryResponse,
  HistoryItem,
  PingResponse,
} from "../shared/messages";
import { loadSettings } from "../shared/storage";

const HISTORY_LIMIT_DEFAULT = 50;
const HISTORY_LIMIT_MAX = 500;
const HISTORY_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const VERSION = chrome.runtime.getManifest().version;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only respond to our own envelope shape; anything else falls through to
  // the next listener (there are no others — this is just defence in depth).
  if (!isExtensionRequest(message)) return false;

  void handleRequest(message, sender)
    .then((response) => sendResponse(response))
    .catch((err: unknown) => {
      sendResponse({
        type: "cloudos:ext:get-history:result",
        id: message.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      } satisfies GetHistoryError);
    });

  // Returning true keeps `sendResponse` valid for the async path above.
  return true;
});

async function handleRequest(
  message: ExtensionRequest,
  sender: chrome.runtime.MessageSender,
): Promise<ExtensionResponse> {
  if (message.type === "cloudos:ext:ping") {
    return {
      type: "cloudos:ext:ping:result",
      id: message.id,
      ok: true,
      version: VERSION,
    } satisfies PingResponse;
  }
  return await fetchHistory(message, sender);
}

async function fetchHistory(
  message: Extract<ExtensionRequest, { type: "cloudos:ext:get-history" }>,
  sender: chrome.runtime.MessageSender,
): Promise<GetHistoryResponse | GetHistoryError> {
  const settings = await loadSettings();
  if (!settings.historyBridgeEnabled) {
    return errorResponse(message.id, "history bridge disabled in extension options");
  }
  const senderOrigin = sender.origin ?? originOf(sender.url ?? "");
  const expectedOrigin = originOf(settings.cloudosUrl);
  if (!senderOrigin || !expectedOrigin || senderOrigin !== expectedOrigin) {
    return errorResponse(message.id, "request origin does not match the configured CloudOS URL");
  }

  const limit = clamp(message.limit ?? HISTORY_LIMIT_DEFAULT, 1, HISTORY_LIMIT_MAX);
  const startTime = message.since ?? Date.now() - HISTORY_LOOKBACK_MS;
  const text = message.text ?? "";

  const raw = await chrome.history.search({
    text,
    startTime,
    maxResults: limit,
  });
  const items: HistoryItem[] = raw
    .filter((entry): entry is chrome.history.HistoryItem & { url: string } => Boolean(entry.url))
    .map((entry) => ({
      url: entry.url,
      title: entry.title ?? "",
      lastVisitTime: entry.lastVisitTime ?? 0,
      visitCount: entry.visitCount ?? 0,
    }));

  return {
    type: "cloudos:ext:get-history:result",
    id: message.id,
    ok: true,
    items,
  } satisfies GetHistoryResponse;
}

function errorResponse(id: string | number, error: string): GetHistoryError {
  return { type: "cloudos:ext:get-history:result", id, ok: false, error };
}

function isExtensionRequest(value: unknown): value is ExtensionRequest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { type?: unknown };
  return candidate.type === "cloudos:ext:get-history" || candidate.type === "cloudos:ext:ping";
}

function originOf(rawUrl: string): string | null {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl).origin;
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

// ---------------------------------------------------------------------------
// Dynamic content-script registration
// ---------------------------------------------------------------------------
//
// The bridge content script needs to run in whichever origin the user
// configured as their CloudOS instance. We can't list that statically in
// the manifest because it's user-configurable, so we register the script
// at runtime once (a) the user has saved a URL, (b) they've toggled the
// history bridge on, and (c) they've granted host permission for that
// origin via `chrome.permissions.request`.

const BRIDGE_SCRIPT_ID = "cloudos-bridge";

async function syncContentScripts(): Promise<void> {
  // Always start by removing any previous registration so URL changes don't
  // leak the old origin.
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [BRIDGE_SCRIPT_ID] });
  } catch {
    // unregister throws when the id isn't currently registered; that's fine.
  }

  const settings = await loadSettings();
  const expectedOrigin = originOf(settings.cloudosUrl);
  if (!expectedOrigin) return;
  if (!settings.historyBridgeEnabled) return;

  const matchPattern = `${expectedOrigin}/*`;
  const hasPerm = await chrome.permissions.contains({ origins: [matchPattern] });
  if (!hasPerm) return;

  try {
    await chrome.scripting.registerContentScripts([
      {
        id: BRIDGE_SCRIPT_ID,
        matches: [matchPattern],
        js: ["content/bridge.js"],
        runAt: "document_idle",
        allFrames: false,
      },
    ]);
  } catch (err) {
    console.warn("[cloudos] failed to register bridge content script", err);
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  void syncContentScripts();
  // Open the options page on first install so the user knows what to do.
  if (details.reason === "install" && chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onStartup.addListener(() => {
  void syncContentScripts();
});

chrome.permissions.onAdded.addListener(() => {
  void syncContentScripts();
});

chrome.permissions.onRemoved.addListener(() => {
  void syncContentScripts();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if ("cloudosUrl" in changes || "historyBridgeEnabled" in changes) {
    void syncContentScripts();
  }
});

// Toolbar action: open the full options tab instead of a popup. The popup
// route makes the page render at ~360px which truncates the URL field, and
// users expect "click icon → settings tab".
chrome.action.onClicked.addListener(() => {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  }
});
