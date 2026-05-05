import { Component, createSignal, onMount, onCleanup, For, Show } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { token } from "../stores/auth-store";

interface HistoryEntry {
  input: string;
  output: string;
}

type TabMode = "local" | "remote";

interface Tab {
  id: number;
  title: string;
  mode: TabMode;
  /** Local-mode shell history. Unused for remote tabs. */
  history: HistoryEntry[];
  cwd: string;
  /** Remote-mode connection status (purely cosmetic). */
  remoteStatus?: "connecting" | "open" | "closed" | "error";
}

let tabId = 0;

function createTab(mode: TabMode = "local"): Tab {
  tabId++;
  return {
    id: tabId,
    title: mode === "remote" ? `Shell ${tabId}` : `Terminal ${tabId}`,
    mode,
    history:
      mode === "remote"
        ? []
        : [
            {
              input: "",
              output:
                "CloudOS Terminal v0.1.0\nType 'help' for available commands.\n",
            },
          ],
    cwd: "~",
  };
}

const API_BASE = import.meta.env.VITE_API_URL ?? "/api/v1";

interface PTYHealth {
  enabled: boolean;
  shell?: string;
}

async function fetchPTYHealth(): Promise<PTYHealth> {
  try {
    const res = await fetch(`${API_BASE}/pty/health`);
    if (!res.ok) return { enabled: false };
    return (await res.json()) as PTYHealth;
  } catch {
    return { enabled: false };
  }
}

/**
 * Build the WebSocket URL for the PTY endpoint. Picks ws:// or wss://
 * based on the page protocol, and falls back to a same-origin URL when
 * VITE_API_URL is unset (the common case in dev).
 */
function ptyWsURL(): string {
  const tok = token();
  const tokenParam = tok ? `?token=${encodeURIComponent(tok)}` : "";
  const apiBase = import.meta.env.VITE_API_URL;
  if (apiBase && /^https?:\/\//.test(apiBase)) {
    const u = new URL(apiBase);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    const path = u.pathname.replace(/\/$/, "") + "/pty";
    return `${u.protocol}//${u.host}${path}${tokenParam}`;
  }
  // Same-origin fallback. `${API_BASE}` resolves to "/api/v1" in dev.
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}${API_BASE}/pty${tokenParam}`;
}

const Terminal: Component<{ windowId: string }> = () => {
  const [tabs, setTabs] = createStore<Tab[]>([createTab("local")]);
  const [activeTabId, setActiveTabId] = createSignal(tabs[0].id);
  const [input, setInput] = createSignal("");
  const [ptyAvailable, setPtyAvailable] = createSignal(false);
  let inputRef!: HTMLInputElement;
  let scrollRef!: HTMLDivElement;

  const username = "user@cloudos";

  const activeTab = () => tabs.find((t) => t.id === activeTabId())!;

  // Per-tab xterm instance + WS, kept outside the SolidJS store so we
  // don't try to make them reactive (they're imperative DOM).
  const xtermByTab = new Map<number, { term: XTerm; fit: FitAddon; ws: WebSocket | null }>();

  onMount(async () => {
    inputRef?.focus();
    const health = await fetchPTYHealth();
    setPtyAvailable(health.enabled);
  });

  onCleanup(() => {
    for (const [, h] of xtermByTab) {
      try {
        h.ws?.close();
      } catch {
        /* ignore */
      }
      h.term.dispose();
    }
  });

  // ─── local-mode command parser (kept verbatim from previous impl) ───
  const executeCommand = (cmd: string) => {
    const parts = cmd.trim().split(/\s+/);
    const command = parts[0]?.toLowerCase() ?? "";
    let output = "";

    switch (command) {
      case "help":
        output =
          "Available commands:\n  help      - Show this help\n  echo      - Print text\n  clear     - Clear terminal\n  date      - Show current date\n  whoami    - Show username\n  pwd       - Print working directory\n  uname     - System information\n  neofetch  - System info (fancy)\n  ls        - List files (demo)\n  cat       - Read file (demo)\n  cd        - Change directory (demo)\n  history   - Show command history\n  uptime    - Show uptime\n  copy      - Copy <text> to the system clipboard\n  paste     - Print the system clipboard contents\n  remote    - Open a real shell tab via the WS pty backend\n\nKeyboard:\n  Ctrl+Shift+C  Copy selection (or current prompt) to clipboard\n  Ctrl+Shift+V  Paste clipboard at the prompt cursor";
        break;
      case "echo":
        output = parts.slice(1).join(" ");
        break;
      case "clear":
        setTabs((t) => t.id === activeTabId(), "history", []);
        setInput("");
        return;
      case "date":
        output = new Date().toString();
        break;
      case "whoami":
        output = "user";
        break;
      case "pwd":
        output = activeTab().cwd === "~" ? "/home/user" : activeTab().cwd;
        break;
      case "uname":
        output = parts[1] === "-a" ? "CloudOS 0.1.0 Browser x86_64 CloudOS" : "CloudOS";
        break;
      case "neofetch":
        output = `       ╭──────────╮
       │ CloudOS  │    user@cloudos
       │  ☁️  OS  │    -----------
       │          │    OS: CloudOS 0.1.0
       ╰──────────╯    Host: Browser
                        Kernel: SolidJS
                        Shell: cloudsh 0.1
                        Terminal: WebTerminal
                        CPU: Your Browser
                        Memory: ${Math.round(
                          (performance as { memory?: { usedJSHeapSize: number } }).memory
                            ?.usedJSHeapSize / 1024 / 1024 || 0,
                        )}MB`;
        break;
      case "ls":
        output = "Documents  Downloads  Pictures  Music  Videos  Desktop";
        break;
      case "cat":
        if (parts[1]) {
          output = `cat: ${parts[1]}: connect to backend for real file access`;
        } else {
          output = "cat: missing file operand";
        }
        break;
      case "cd":
        if (parts[1]) {
          const target = parts[1] === "~" ? "~" : parts[1] === ".." ? "~" : parts[1];
          setTabs((t) => t.id === activeTabId(), "cwd", target);
          output = "";
        } else {
          setTabs((t) => t.id === activeTabId(), "cwd", "~");
          output = "";
        }
        break;
      case "history":
        output =
          activeTab()
            .history.filter((h) => h.input)
            .map((h, i) => `  ${i + 1}  ${h.input}`)
            .join("\n") || "(empty)";
        break;
      case "copy":
        if (!parts[1]) {
          output = "copy: missing argument (try `copy <text>`)";
          break;
        }
        copyToClipboard(parts.slice(1).join(" "))
          .then((ok) => {
            setTabs(
              (t) => t.id === activeTabId(),
              "history",
              produce((h: HistoryEntry[]) => {
                h.push({
                  input: "",
                  output: ok ? "copied to clipboard" : "copy: clipboard unavailable",
                });
              }),
            );
          });
        output = "";
        break;
      case "uptime": {
        const secs = Math.floor(performance.now() / 1000);
        const mins = Math.floor(secs / 60);
        const hrs = Math.floor(mins / 60);
        output = `up ${hrs}h ${mins % 60}m ${secs % 60}s`;
        break;
      }
      case "remote":
        if (!ptyAvailable()) {
          output = "Remote shell not available (server has ENABLE_PTY=false).";
        } else {
          addRemoteTab();
          output = "";
        }
        break;
      case "paste":
        readFromClipboard().then((t) => {
          setTabs(
            (t2) => t2.id === activeTabId(),
            "history",
            produce((h: HistoryEntry[]) => {
              h.push({
                input: "",
                output: t || "paste: clipboard empty or unavailable",
              });
            }),
          );
        });
        output = "";
        break;
      case "":
        break;
      default:
        output = `${command}: command not found. Type 'help' for available commands.`;
    }

    setTabs(
      (t) => t.id === activeTabId(),
      "history",
      produce((h: HistoryEntry[]) => h.push({ input: cmd, output })),
    );
    setInput("");

    requestAnimationFrame(() => {
      scrollRef?.scrollTo(0, scrollRef.scrollHeight);
    });
  };

  /**
   * Read whatever the user has selected on the page (active terminal
   * history pane, prompt input, etc) and write it to the system
   * clipboard. Returns true on success.
   *
   * Built-in apps don't go through the manifest permission gate, so we
   * call `navigator.clipboard` directly. Falls back to a hidden
   * textarea + `document.execCommand('copy')` for non-secure contexts
   * where `navigator.clipboard` isn't available.
   */
  async function copyToClipboard(text: string): Promise<boolean> {
    if (!text) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall through
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  async function readFromClipboard(): Promise<string> {
    try {
      if (navigator.clipboard?.readText) return await navigator.clipboard.readText();
    } catch {
      // ignore — most often a permission-denied or non-secure-context error
    }
    return "";
  }

  /**
   * Splice `text` into the prompt input at the current cursor position,
   * stripping CR/LF (the Enter handler is responsible for executing).
   * Used by the local-mode paste shortcut.
   */
  function pasteIntoInput(text: string) {
    const sanitized = text.replace(/\r\n?/g, "\n").replace(/\n+/g, " ");
    const el = inputRef;
    if (!el) {
      setInput(input() + sanitized);
      return;
    }
    const start = el.selectionStart ?? input().length;
    const end = el.selectionEnd ?? input().length;
    const cur = input();
    const next = cur.slice(0, start) + sanitized + cur.slice(end);
    setInput(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + sanitized.length;
      try { el.setSelectionRange(pos, pos); } catch { /* ignore */ }
    });
  }

  /**
   * Local-mode copy/paste shortcut handler. Bound on the outer
   * Terminal container (so it works whether the input or the history
   * pane has focus) and only fires on Ctrl+Shift+C / Ctrl+Shift+V so
   * it never interferes with native Ctrl+C copy of selected text or
   * the input's own Ctrl+V paste.
   */
  const handleLocalCopyPaste = (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
    const k = e.key.toLowerCase();
    if (k === "c") {
      const sel = window.getSelection?.()?.toString() ?? "";
      const text = sel || input();
      if (text) {
        e.preventDefault();
        void copyToClipboard(text);
      }
      return;
    }
    if (k === "v") {
      e.preventDefault();
      void readFromClipboard().then((t) => {
        if (t) pasteIntoInput(t);
      });
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      executeCommand(input());
    }
  };

  // ─── tab management ──────────────────────────────────────────────────
  const addTab = () => {
    const tab = createTab("local");
    setTabs(produce((t: Tab[]) => t.push(tab)));
    setActiveTabId(tab.id);
  };
  const addRemoteTab = () => {
    if (!ptyAvailable()) return;
    const tab = createTab("remote");
    setTabs(produce((t: Tab[]) => t.push(tab)));
    setActiveTabId(tab.id);
  };
  const closeTab = (id: number) => {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === id);
    const handle = xtermByTab.get(id);
    if (handle) {
      try {
        handle.ws?.close();
      } catch {
        /* ignore */
      }
      handle.term.dispose();
      xtermByTab.delete(id);
    }
    setTabs(produce((t: Tab[]) => t.splice(idx, 1)));
    if (activeTabId() === id) {
      setActiveTabId(tabs[Math.max(0, idx - 1)]?.id ?? tabs[0].id);
    }
  };

  // ─── remote tab attach: mount xterm + open WS ────────────────────────
  const attachXTerm = (host: HTMLDivElement, tab: Tab) => {
    if (xtermByTab.has(tab.id)) {
      // Already attached. Re-fit in case the window was resized while inactive.
      const h = xtermByTab.get(tab.id)!;
      try { h.fit.fit(); } catch { /* ignore */ }
      return;
    }
    const term = new XTerm({
      fontFamily: "ui-monospace, Menlo, Monaco, Consolas, monospace",
      fontSize: 13,
      cursorBlink: true,
      theme: {
        background: "#0d1117",
        foreground: "#c9d1d9",
        cursor: "#58a6ff",
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    try { fit.fit(); } catch { /* ignore */ }

    // Ctrl+Shift+C / Ctrl+Shift+V — clipboard handling for the remote
    // pty tab. Returning false from the handler prevents xterm from
    // forwarding the key to the pty (so the shell doesn't see a stray
    // Ctrl-C / Ctrl-V). Plain Ctrl+C is left untouched and continues to
    // be sent through as SIGINT.
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== "keydown") return true;
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return true;
      const k = e.key.toLowerCase();
      if (k === "c") {
        const sel = term.getSelection();
        if (sel) void copyToClipboard(sel);
        return false;
      }
      if (k === "v") {
        void readFromClipboard().then((t) => {
          if (t) term.paste(t);
        });
        return false;
      }
      return true;
    });

    setTabs((t) => t.id === tab.id, "remoteStatus", "connecting");
    const ws = new WebSocket(ptyWsURL());
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      setTabs((t) => t.id === tab.id, "remoteStatus", "open");
      // Send initial size so the shell knows our viewport.
      ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        term.write(ev.data);
      } else {
        term.write(new Uint8Array(ev.data as ArrayBuffer));
      }
    };
    ws.onerror = () => {
      setTabs((t) => t.id === tab.id, "remoteStatus", "error");
      term.write("\r\n\x1b[31mconnection error\x1b[0m\r\n");
    };
    ws.onclose = () => {
      setTabs((t) => t.id === tab.id, "remoteStatus", "closed");
      term.write("\r\n\x1b[33mconnection closed\x1b[0m\r\n");
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode(data));
      }
    });
    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    });

    // Re-fit when host element changes size (debounced via rAF).
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try { fit.fit(); } catch { /* ignore */ }
      });
    });
    ro.observe(host);

    xtermByTab.set(tab.id, { term, fit, ws });
  };

  return (
    <div
      class="h-full flex flex-col bg-[#0d1117] font-mono text-[13px] text-[#c9d1d9] overflow-hidden"
      tabIndex={-1}
      onClick={() => {
        if (activeTab().mode === "local") inputRef?.focus();
      }}
      onKeyDown={(e) => {
        if (activeTab().mode === "local") handleLocalCopyPaste(e);
      }}
    >
      {/* Tab Bar */}
      <div class="flex items-center bg-[#161b22] border-b border-[#30363d] text-xs min-h-[28px]">
        <For each={tabs}>
          {(tab) => (
            <div
              class="flex items-center gap-1 px-3 py-1.5 cursor-pointer border-r border-[#30363d] max-w-[170px] transition-colors"
              classList={{
                "bg-[#0d1117] text-[#c9d1d9]": activeTabId() === tab.id,
                "text-[#8b949e] hover:bg-[#1c2128]": activeTabId() !== tab.id,
              }}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span title={tab.mode === "remote" ? "Remote shell (WS pty)" : "Local terminal"}>
                {tab.mode === "remote" ? "🔌" : "💻"}
              </span>
              <span class="truncate">{tab.title}</span>
              <Show when={tab.mode === "remote"}>
                <span
                  class="w-1.5 h-1.5 rounded-full"
                  classList={{
                    "bg-emerald-400": tab.remoteStatus === "open",
                    "bg-amber-400": tab.remoteStatus === "connecting",
                    "bg-red-400": tab.remoteStatus === "error" || tab.remoteStatus === "closed",
                  }}
                />
              </Show>
              <Show when={tabs.length > 1}>
                <button
                  type="button"
                  class="ml-1 text-[10px] text-[#8b949e] hover:text-white rounded hover:bg-white/10 w-4 h-4 flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                >
                  ×
                </button>
              </Show>
            </div>
          )}
        </For>
        <button
          type="button"
          class="px-2 py-1 text-[#8b949e] hover:text-white hover:bg-[#1c2128] transition-colors"
          onClick={addTab}
          title="New local tab"
        >
          +
        </button>
        <Show when={ptyAvailable()}>
          <button
            type="button"
            class="px-2 py-1 text-[#8b949e] hover:text-emerald-300 hover:bg-[#1c2128] transition-colors"
            onClick={addRemoteTab}
            title="Open remote shell (WS pty)"
          >
            🔌+
          </button>
        </Show>
      </div>

      {/* Terminal Content */}
      <Show
        when={activeTab().mode === "local"}
        fallback={<RemoteTabBody tab={activeTab()} attach={attachXTerm} />}
      >
        <div ref={scrollRef} class="flex-1 overflow-y-auto p-3 space-y-1">
          <For each={activeTab().history}>
            {(entry) => (
              <div>
                {entry.input && (
                  <div class="flex gap-1">
                    <span class="text-[#58a6ff]">{username}</span>
                    <span class="text-[#8b949e]">:</span>
                    <span class="text-[#7ee787]">{activeTab().cwd}</span>
                    <span class="text-[#8b949e]">$</span>
                    <span class="ml-1">{entry.input}</span>
                  </div>
                )}
                {entry.output && (
                  <pre class="whitespace-pre-wrap text-[#8b949e] mt-0.5">{entry.output}</pre>
                )}
              </div>
            )}
          </For>

          {/* Active prompt */}
          <div class="flex gap-1 items-center">
            <span class="text-[#58a6ff]">{username}</span>
            <span class="text-[#8b949e]">:</span>
            <span class="text-[#7ee787]">{activeTab().cwd}</span>
            <span class="text-[#8b949e]">$</span>
            <input
              ref={inputRef}
              type="text"
              value={input()}
              onInput={(e) => setInput(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              class="flex-1 ml-1 bg-transparent text-[#c9d1d9] focus:outline-none caret-[#58a6ff]"
              spellcheck={false}
              autocomplete="off"
            />
          </div>
        </div>
      </Show>
    </div>
  );
};

/**
 * Remote (xterm.js) tab body. Mount a host div and let the parent attach
 * an xterm Terminal + WS to it. We intentionally don't render anything
 * SolidJS-reactive inside the host — xterm owns its DOM.
 */
const RemoteTabBody: Component<{ tab: Tab; attach: (host: HTMLDivElement, tab: Tab) => void }> = (props) => {
  let host!: HTMLDivElement;
  onMount(() => props.attach(host, props.tab));
  return <div ref={host} class="flex-1 min-h-0 p-2 bg-[#0d1117]" />;
};

export default Terminal;
