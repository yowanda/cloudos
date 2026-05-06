// Shared storage helpers for the CloudOS extension.
//
// Settings live in `chrome.storage.sync` so they roam across browsers signed
// into the same Chrome / Firefox profile.

export interface ExtensionSettings {
  /**
   * Origin (scheme + host + optional port) of the user's CloudOS instance.
   * Empty string means "not configured yet" — the new-tab page will render a
   * setup screen instead of redirecting.
   */
  cloudosUrl: string;
  /**
   * When true, the new-tab page redirects with `location.replace`. When
   * false, it renders an embedded iframe. The iframe variant only works for
   * CloudOS instances that don't set `X-Frame-Options: deny` — many self-host
   * setups do, so the redirect mode is the safer default.
   */
  embedMode: "redirect" | "iframe";
  /**
   * Whether the content-script bridge is allowed to answer
   * `cloudos:ext:get-history` postMessages. Defaults to false; the user
   * has to opt in from the options page because it grants the configured
   * CloudOS origin read access to the browser's full history.
   */
  historyBridgeEnabled: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  cloudosUrl: "",
  embedMode: "redirect",
  historyBridgeEnabled: false,
};

const KEYS = Object.keys(DEFAULT_SETTINGS) as Array<keyof ExtensionSettings>;

export async function loadSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.sync.get(KEYS);
  return { ...DEFAULT_SETTINGS, ...(stored as Partial<ExtensionSettings>) };
}

export async function saveSettings(patch: Partial<ExtensionSettings>): Promise<void> {
  await chrome.storage.sync.set(patch);
}

/**
 * Normalise a user-typed URL into an origin string ("https://host[:port]").
 * Returns null when the input is not a valid http(s) URL — callers should
 * surface a friendly error instead of silently saving garbage.
 */
export function normaliseUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // Strip trailing slash from pathname so `/` and `` are equivalent.
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
    return `${url.origin}${path}`;
  } catch {
    return null;
  }
}
