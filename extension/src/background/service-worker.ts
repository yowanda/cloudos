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

// Surface install / update events so the user sees an options page on first
// install. A noop on update so we don't surprise them with a new tab.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install" && chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  }
});
