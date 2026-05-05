import { Component, For, Show, createSignal, onMount } from "solid-js";

interface HistoryEntry {
  url: string;
  /** Best-effort title — for now we store the hostname; iframes are
   *  cross-origin so we can't read their `document.title`. */
  title: string;
  visitedAt: number;
}

interface Bookmark {
  url: string;
  title: string;
  addedAt: number;
}

const HISTORY_KEY = "cloudos:browser:history";
const BOOKMARKS_KEY = "cloudos:browser:bookmarks";
const HISTORY_MAX = 200;

function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_MAX)));
  } catch {
    // ignore quota
  }
}

function loadBookmarks(): Bookmark[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Bookmark[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveBookmarks(arr: Bookmark[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

/** Best-effort URL → "https://" normalization. */
function normalizeUrl(input: string): string {
  const t = input.trim();
  if (!t) return "";
  // Don't add a scheme to chrome:// / file:// / about: / data: etc.
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return t;
  return `https://${t}`;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

const HOMEPAGE = "https://example.com";

const Browser: Component<{ windowId: string }> = () => {
  const [urlInput, setUrlInput] = createSignal(HOMEPAGE);
  const [loadedUrl, setLoadedUrl] = createSignal(HOMEPAGE);

  // Internal back/forward stacks. The iframe's own history is locked
  // off behind same-origin restrictions, so we maintain our own.
  const [backStack, setBackStack] = createSignal<string[]>([]);
  const [forwardStack, setForwardStack] = createSignal<string[]>([]);

  const [history, setHistory] = createSignal<HistoryEntry[]>(loadHistory());
  const [bookmarks, setBookmarks] = createSignal<Bookmark[]>(loadBookmarks());
  const [panel, setPanel] = createSignal<"none" | "history" | "bookmarks">("none");
  let iframeEl: HTMLIFrameElement | undefined;

  const isBookmarked = () => bookmarks().some((b) => b.url === loadedUrl());

  const recordVisit = (url: string) => {
    const entry: HistoryEntry = { url, title: hostnameOf(url), visitedAt: Date.now() };
    // Dedupe: if the most-recent entry is the same URL, refresh its
    // timestamp instead of adding a duplicate.
    const next = [entry, ...history().filter((h) => h.url !== url)].slice(0, HISTORY_MAX);
    setHistory(next);
    saveHistory(next);
  };

  /** Loads `target` into the iframe and updates back/forward stacks.
   *  When `pushHistory` is false (back/forward navigation), the
   *  back/forward stacks are managed by the caller. */
  const goTo = (target: string, opts: { pushHistory?: boolean } = { pushHistory: true }) => {
    const norm = normalizeUrl(target);
    if (!norm) return;
    if (opts.pushHistory && loadedUrl() && loadedUrl() !== norm) {
      setBackStack([...backStack(), loadedUrl()]);
      setForwardStack([]);
    }
    setUrlInput(norm);
    setLoadedUrl(norm);
    recordVisit(norm);
  };

  const goBack = () => {
    const back = backStack();
    if (back.length === 0) return;
    const target = back[back.length - 1];
    setBackStack(back.slice(0, -1));
    setForwardStack([loadedUrl(), ...forwardStack()]);
    setUrlInput(target);
    setLoadedUrl(target);
    // Don't re-record in history — the user is moving through their
    // existing history.
  };

  const goForward = () => {
    const fwd = forwardStack();
    if (fwd.length === 0) return;
    const target = fwd[0];
    setForwardStack(fwd.slice(1));
    setBackStack([...backStack(), loadedUrl()]);
    setUrlInput(target);
    setLoadedUrl(target);
  };

  const reload = () => {
    // Re-assigning src to its current value triggers a fresh load,
    // even when the URL hasn't changed.
    if (iframeEl) iframeEl.src = loadedUrl();
  };

  const toggleBookmark = () => {
    const url = loadedUrl();
    if (!url) return;
    const existing = bookmarks().find((b) => b.url === url);
    if (existing) {
      const next = bookmarks().filter((b) => b.url !== url);
      setBookmarks(next);
      saveBookmarks(next);
    } else {
      const next = [{ url, title: hostnameOf(url), addedAt: Date.now() } as Bookmark, ...bookmarks()];
      setBookmarks(next);
      saveBookmarks(next);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  const removeHistoryEntry = (url: string) => {
    const next = history().filter((h) => h.url !== url);
    setHistory(next);
    saveHistory(next);
  };

  const removeBookmark = (url: string) => {
    const next = bookmarks().filter((b) => b.url !== url);
    setBookmarks(next);
    saveBookmarks(next);
  };

  onMount(() => {
    // Record the initial homepage visit so it shows up in history.
    recordVisit(HOMEPAGE);
  });

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <div class="h-full flex flex-col bg-os-window overflow-hidden">
      {/* Toolbar */}
      <div class="flex items-center gap-1 px-2 py-1.5 bg-os-window-title border-b border-os-border">
        <button
          class="px-2 py-1 rounded hover:bg-os-surface-hover text-sm disabled:opacity-30 disabled:hover:bg-transparent"
          onClick={goBack}
          disabled={backStack().length === 0}
          title="Back (Alt+←)"
        >
          ←
        </button>
        <button
          class="px-2 py-1 rounded hover:bg-os-surface-hover text-sm disabled:opacity-30 disabled:hover:bg-transparent"
          onClick={goForward}
          disabled={forwardStack().length === 0}
          title="Forward (Alt+→)"
        >
          →
        </button>
        <button
          class="px-2 py-1 rounded hover:bg-os-surface-hover text-sm"
          onClick={reload}
          title="Reload"
        >
          🔄
        </button>
        <input
          type="text"
          value={urlInput()}
          onInput={(e) => setUrlInput(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") goTo(urlInput());
          }}
          class="flex-1 px-3 py-1 text-xs rounded-lg bg-os-surface border border-os-border text-os-text focus:outline-none focus:border-os-accent"
          placeholder="Enter URL or search…"
        />
        <button
          class="px-2 py-1 rounded hover:bg-os-surface-hover text-sm"
          classList={{ "text-os-warning": isBookmarked() }}
          onClick={toggleBookmark}
          title={isBookmarked() ? "Remove bookmark" : "Bookmark this page"}
        >
          {isBookmarked() ? "★" : "☆"}
        </button>
        <button
          class="px-2 py-1 rounded hover:bg-os-surface-hover text-sm"
          classList={{ "bg-os-surface-hover": panel() === "bookmarks" }}
          onClick={() => setPanel(panel() === "bookmarks" ? "none" : "bookmarks")}
          title="Bookmarks"
        >
          📚
        </button>
        <button
          class="px-2 py-1 rounded hover:bg-os-surface-hover text-sm"
          classList={{ "bg-os-surface-hover": panel() === "history" }}
          onClick={() => setPanel(panel() === "history" ? "none" : "history")}
          title="History"
        >
          🕘
        </button>
        <button
          class="px-3 py-1 rounded bg-os-accent text-white text-xs hover:bg-os-accent-hover"
          onClick={() => goTo(urlInput())}
        >
          Go
        </button>
      </div>

      {/* Body: side panel + iframe */}
      <div class="flex-1 flex min-h-0">
        <Show when={panel() === "history"}>
          <div class="w-72 border-r border-os-border flex flex-col bg-os-window">
            <div class="px-3 py-2 border-b border-os-border flex items-center justify-between">
              <span class="text-xs font-semibold">History</span>
              <button
                class="text-[10px] text-os-text-muted hover:text-os-danger"
                onClick={clearHistory}
                disabled={history().length === 0}
              >
                Clear all
              </button>
            </div>
            <div class="flex-1 overflow-y-auto">
              <Show
                when={history().length > 0}
                fallback={<div class="p-4 text-center text-os-text-muted text-xs">No history yet</div>}
              >
                <For each={history()}>
                  {(h) => (
                    <div class="group flex items-start gap-2 px-3 py-2 hover:bg-os-surface-hover cursor-pointer text-xs border-b border-os-border/50">
                      <button class="flex-1 min-w-0 text-left" onClick={() => goTo(h.url)}>
                        <div class="truncate font-medium">{h.title}</div>
                        <div class="truncate text-[10px] text-os-text-muted">{h.url}</div>
                        <div class="text-[10px] text-os-text-muted mt-0.5">{formatDate(h.visitedAt)}</div>
                      </button>
                      <button
                        class="opacity-0 group-hover:opacity-100 px-1 text-os-danger hover:text-os-danger/80"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeHistoryEntry(h.url);
                        }}
                        title="Remove from history"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </div>
        </Show>

        <Show when={panel() === "bookmarks"}>
          <div class="w-72 border-r border-os-border flex flex-col bg-os-window">
            <div class="px-3 py-2 border-b border-os-border">
              <span class="text-xs font-semibold">Bookmarks</span>
            </div>
            <div class="flex-1 overflow-y-auto">
              <Show
                when={bookmarks().length > 0}
                fallback={
                  <div class="p-4 text-center text-os-text-muted text-xs">
                    Click ★ in the toolbar to bookmark the current page.
                  </div>
                }
              >
                <For each={bookmarks()}>
                  {(b) => (
                    <div class="group flex items-start gap-2 px-3 py-2 hover:bg-os-surface-hover cursor-pointer text-xs border-b border-os-border/50">
                      <button class="flex-1 min-w-0 text-left" onClick={() => goTo(b.url)}>
                        <div class="truncate font-medium">⭐ {b.title}</div>
                        <div class="truncate text-[10px] text-os-text-muted">{b.url}</div>
                      </button>
                      <button
                        class="opacity-0 group-hover:opacity-100 px-1 text-os-danger hover:text-os-danger/80"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBookmark(b.url);
                        }}
                        title="Remove bookmark"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </div>
        </Show>

        <iframe
          ref={iframeEl}
          src={loadedUrl()}
          class="flex-1 w-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title="Browser"
        />
      </div>
    </div>
  );
};

export default Browser;
