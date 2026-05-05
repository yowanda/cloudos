import { Component, For, Show, createMemo, createSignal, lazy, onCleanup, onMount } from "solid-js";
import { writeFile, VFSQuotaExceededError, formatSize, getEntry } from "../vfs/vfs";
import { notify } from "../stores/notification-store";
import { detectLanguage, languageLabel, tokenize, tokenClass, type Language } from "../core/syntax";
import { getVfsDragPath, isAcceptableDrop } from "../core/drag-drop";
import { useMonaco } from "../core/editor-prefs";

// Lazy chunk — Monaco itself is ~3 MB and must NOT enter the initial bundle.
// `solid-js`' `lazy()` does the dynamic import + Suspense boundary for us.
const MonacoEditor = lazy(() => import("./MonacoEditor"));

/**
 * Cross-window handoff signal — File Manager queues a file open here, the
 * editor consumes it on mount (mirrors ImageViewer.openImageInViewer).
 */
interface PendingOpen {
  path: string;
  name: string;
  content: string;
  language?: Language;
}
const [pendingOpen, setPendingOpen] = createSignal<PendingOpen | null>(null);

export function openInEditor(opts: PendingOpen) {
  setPendingOpen(opts);
}

interface Tab {
  id: number;
  /** Absolute VFS path; null for unsaved scratch tabs. */
  path: string | null;
  name: string;
  content: string;
  savedContent: string;
  language: Language;
}

let tabSeq = 0;
function newTab(partial: Partial<Tab>): Tab {
  const name = partial.name ?? "untitled.txt";
  const content = partial.content ?? "";
  return {
    id: ++tabSeq,
    path: partial.path ?? null,
    name,
    content,
    savedContent: partial.savedContent ?? content,
    language: partial.language ?? detectLanguage(name),
  };
}

const TextEditor: Component<{ windowId: string }> = () => {
  const [tabs, setTabs] = createSignal<Tab[]>([newTab({
    name: "untitled.js",
    content: "// Welcome to CloudOS Editor\n// Start typing — Ctrl+S saves to /Documents.\n\nfunction hello() {\n  console.log('Hello, CloudOS!');\n}\n\nhello();\n",
    language: "javascript",
  })]);
  const [activeId, setActiveId] = createSignal<number>(tabs()[0].id);
  const [findOpen, setFindOpen] = createSignal(false);
  const [isDragOver, setIsDragOver] = createSignal(false);
  const [findQuery, setFindQuery] = createSignal("");
  const [replaceQuery, setReplaceQuery] = createSignal("");

  let textareaRef: HTMLTextAreaElement | undefined;
  let highlightRef: HTMLDivElement | undefined;

  const activeTab = createMemo(() => tabs().find((t) => t.id === activeId()) ?? tabs()[0]);
  const activeContent = () => activeTab()?.content ?? "";
  const lineCount = () => activeContent().split("\n").length;
  const isModified = (t: Tab) => t.content !== t.savedContent;

  const tokens = createMemo(() => {
    const t = activeTab();
    if (!t) return [];
    return tokenize(t.content, t.language);
  });

  // ─── tab management ──────────────────────────────────────────────────
  const updateTab = (id: number, patch: Partial<Tab>) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };
  const closeTab = (id: number) => {
    const t = tabs().find((x) => x.id === id);
    if (!t) return;
    if (isModified(t) && !confirm(`Discard unsaved changes in ${t.name}?`)) return;
    setTabs((prev) => {
      const next = prev.filter((x) => x.id !== id);
      if (next.length === 0) {
        const fresh = newTab({});
        return [fresh];
      }
      return next;
    });
    queueMicrotask(() => {
      // Pick any remaining tab if the active one closed.
      if (!tabs().some((x) => x.id === activeId()) && tabs().length > 0) {
        setActiveId(tabs()[0].id);
      }
    });
  };
  const newScratch = () => {
    const t = newTab({ name: `untitled-${tabs().length + 1}.txt`, content: "", language: "plaintext" });
    setTabs((prev) => [...prev, t]);
    setActiveId(t.id);
  };

  // ─── save ────────────────────────────────────────────────────────────
  const saveActive = () => {
    const t = activeTab();
    if (!t) return;
    let path = t.path;
    if (!path) {
      const suggested = `/Documents/${t.name}`;
      const input = prompt("Save as (absolute VFS path):", suggested);
      if (!input) return;
      path = input.startsWith("/") ? input : `/${input}`;
    }
    const segs = path.split("/").filter(Boolean);
    const fileName = segs[segs.length - 1] ?? t.name;
    let entry;
    try {
      entry = writeFile(path, t.content);
    } catch (e: unknown) {
      if (e instanceof VFSQuotaExceededError) {
        notify({
          title: "Storage quota exceeded",
          message: `Need ${formatSize(e.attemptedDelta)}, only ${formatSize(e.quotaBytes - e.usedBytes)} free. Raise quota or empty trash.`,
          type: "error",
          icon: "💾",
        });
        return;
      }
      throw e;
    }
    if (!entry) {
      notify({ title: "Save failed", message: `Cannot save to ${path}`, type: "error", icon: "💾" });
      return;
    }
    updateTab(t.id, { path, name: fileName, savedContent: t.content, language: detectLanguage(fileName) });
    notify({ title: "Saved", message: path, type: "success", icon: "💾" });
  };

  /** Open a tab for an already-loaded file (or focus the existing tab if any). */
  const openLoaded = (path: string, name: string, content: string, language?: Language) => {
    const lang = language ?? detectLanguage(name);
    const tab = newTab({ path, name, content, savedContent: content, language: lang });
    setTabs((prev) => {
      const found = prev.find((t) => t.path && t.path === path);
      if (found) {
        setActiveId(found.id);
        return prev;
      }
      return [...prev, tab];
    });
    setActiveId(tab.id);
  };

  /** Look up `path` in the VFS and open it (if it's a regular file). */
  const openVfsPath = (path: string): boolean => {
    const entry = getEntry(path);
    if (!entry || entry.isDir) {
      notify({ title: "Can't open", message: `${path} is not a file`, type: "warning", icon: "📜" });
      return false;
    }
    openLoaded(entry.path, entry.name, entry.content ?? "");
    return true;
  };

  // ─── consume cross-window open signal ────────────────────────────────
  onMount(() => {
    const pending = pendingOpen();
    if (pending) {
      setPendingOpen(null);
      openLoaded(pending.path, pending.name, pending.content, pending.language);
    }
  });

  // ─── keyboard shortcuts (capture only when our textarea is focused) ──
  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.target instanceof Element)) return;
      const inside = e.target === textareaRef || e.target.closest?.("[data-cloudos-editor='1']");
      if (!inside) return;
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case "s":
            e.preventDefault();
            saveActive();
            return;
          case "n":
            e.preventDefault();
            newScratch();
            return;
          case "w":
            e.preventDefault();
            closeTab(activeId());
            return;
          case "f":
            e.preventDefault();
            setFindOpen(true);
            return;
        }
      }
      if (e.key === "Escape" && findOpen()) {
        e.preventDefault();
        setFindOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  // ─── scroll sync between textarea + highlight overlay ────────────────
  const onScroll = () => {
    if (!textareaRef || !highlightRef) return;
    highlightRef.scrollTop = textareaRef.scrollTop;
    highlightRef.scrollLeft = textareaRef.scrollLeft;
  };

  const onContentInput = (val: string) => {
    const t = activeTab();
    if (!t) return;
    updateTab(t.id, { content: val });
  };

  // ─── find / replace ──────────────────────────────────────────────────
  const findNext = () => {
    if (!textareaRef || !findQuery()) return;
    const content = activeContent();
    const startFrom = textareaRef.selectionEnd ?? 0;
    const idx = content.indexOf(findQuery(), startFrom);
    const next = idx >= 0 ? idx : content.indexOf(findQuery(), 0);
    if (next < 0) return;
    textareaRef.focus();
    textareaRef.setSelectionRange(next, next + findQuery().length);
  };
  const replaceAll = () => {
    if (!findQuery()) return;
    const t = activeTab();
    if (!t) return;
    const next = t.content.split(findQuery()).join(replaceQuery());
    updateTab(t.id, { content: next });
  };

  // ─── drop handlers (drag from FileManager / OS) ──────────────────────
  const handleDragOver = (e: DragEvent) => {
    if (!isAcceptableDrop(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };
  const handleDragLeave = (e: DragEvent) => {
    // Ignore leave events for child elements — only clear when leaving the
    // outer container.
    if (e.currentTarget === e.target) setIsDragOver(false);
    else if (!e.relatedTarget || !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };
  const handleDrop = (e: DragEvent) => {
    setIsDragOver(false);
    const vfsPath = getVfsDragPath(e);
    if (vfsPath) {
      e.preventDefault();
      openVfsPath(vfsPath);
      return;
    }
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      e.preventDefault();
      let opened = 0;
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const reader = new FileReader();
        reader.onload = () => {
          openLoaded(`/${f.name}`, f.name, String(reader.result ?? ""));
          opened++;
        };
        reader.readAsText(f);
      }
      // Fire-and-forget notification — readers complete asynchronously.
      notify({ title: "Opening files", message: `${files.length} file${files.length === 1 ? "" : "s"} from your OS`, type: "info", icon: "📜" });
      void opened;
    }
  };

  return (
    <div
      data-cloudos-editor="1"
      class="h-full flex flex-col bg-[#1e1e2e] text-[13px] font-mono overflow-hidden relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Show when={isDragOver()}>
        <div class="pointer-events-none absolute inset-0 z-50 bg-os-accent/15 border-4 border-dashed border-os-accent flex items-center justify-center">
          <div class="text-sm text-white bg-os-accent/80 px-4 py-2 rounded">
            Drop file to open in editor
          </div>
        </div>
      </Show>
      {/* Tab bar */}
      <div class="flex items-center h-9 bg-[#181825] border-b border-[#313244] px-2 gap-1 overflow-x-auto">
        <For each={tabs()}>
          {(tab) => (
            <button
              type="button"
              onClick={() => setActiveId(tab.id)}
              class="group flex items-center gap-2 px-3 py-1 rounded-t text-xs border border-b-0 whitespace-nowrap"
              classList={{
                "bg-[#1e1e2e] border-[#313244] text-[#cdd6f4]": tab.id === activeId(),
                "bg-transparent border-transparent text-[#a6adc8] hover:text-[#cdd6f4]": tab.id !== activeId(),
              }}
            >
              <span>📜</span>
              <span class="max-w-[160px] truncate">{tab.name}</span>
              {isModified(tab) && <span class="w-1.5 h-1.5 rounded-full bg-os-accent" />}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                class="ml-1 opacity-50 hover:opacity-100 cursor-pointer text-[10px]"
                aria-label="Close tab"
              >
                ✕
              </span>
            </button>
          )}
        </For>
        <button
          type="button"
          class="ml-1 text-[#a6adc8] hover:text-[#cdd6f4] text-sm px-2"
          title="New tab (Ctrl+N)"
          onClick={newScratch}
        >
          +
        </button>
        <div class="ml-auto flex items-center gap-2 text-[11px] text-[#6c7086]">
          <button
            type="button"
            class="px-2 py-0.5 rounded hover:bg-white/10"
            onClick={() => setFindOpen((v) => !v)}
            title="Find (Ctrl+F)"
          >
            Find
          </button>
          <button
            type="button"
            class="px-2 py-0.5 rounded bg-os-accent/80 hover:bg-os-accent text-white"
            onClick={saveActive}
            title="Save (Ctrl+S)"
          >
            Save
          </button>
        </div>
      </div>

      {/* Find / Replace bar */}
      <Show when={findOpen()}>
        <div class="flex items-center gap-2 px-3 py-1.5 bg-[#181825] border-b border-[#313244] text-xs">
          <input
            type="text"
            value={findQuery()}
            onInput={(e) => setFindQuery(e.currentTarget.value)}
            placeholder="Find"
            class="px-2 py-1 bg-[#11111b] border border-[#313244] rounded text-[#cdd6f4] focus:outline-none focus:border-os-accent w-48"
          />
          <button type="button" class="px-2 py-1 rounded hover:bg-white/10 text-[#cdd6f4]" onClick={findNext}>
            Next
          </button>
          <input
            type="text"
            value={replaceQuery()}
            onInput={(e) => setReplaceQuery(e.currentTarget.value)}
            placeholder="Replace"
            class="px-2 py-1 bg-[#11111b] border border-[#313244] rounded text-[#cdd6f4] focus:outline-none focus:border-os-accent w-48"
          />
          <button type="button" class="px-2 py-1 rounded hover:bg-white/10 text-[#cdd6f4]" onClick={replaceAll}>
            Replace all
          </button>
          <button type="button" class="ml-auto text-[#6c7086] hover:text-[#cdd6f4]" onClick={() => setFindOpen(false)}>
            ✕
          </button>
        </div>
      </Show>

      {/* Editor area */}
      <div class="flex-1 flex overflow-hidden">
        {/* Line numbers — hidden in Monaco mode (Monaco renders its own). */}
        <Show when={!useMonaco()}>
          <div class="w-12 flex-shrink-0 bg-[#181825] text-[#6c7086] text-right py-2 pr-3 select-none overflow-hidden leading-[20px]">
            <For each={Array.from({ length: lineCount() }, (_, i) => i + 1)}>
              {(n) => <div class="h-[20px]">{n}</div>}
            </For>
          </div>
        </Show>

        {/* Editor surface — either Monaco (if user opted in via Settings)
            or the lightweight built-in textarea + tokenizer overlay.
            Switching at runtime is fully reactive: toggling the setting
            unmounts one branch and mounts the other.
            Monaco brings its own line numbers + scrollbar UI, so the host
            line-number gutter is hidden when Monaco is active. */}
        <Show
          when={useMonaco()}
          fallback={
            <div class="relative flex-1 overflow-hidden">
              <div
                ref={highlightRef}
                aria-hidden="true"
                class="absolute inset-0 p-2 leading-[20px] whitespace-pre overflow-auto pointer-events-none"
                style={{ "tab-size": "2" }}
              >
                <RenderTokens />
              </div>
              <textarea
                ref={textareaRef}
                value={activeContent()}
                onInput={(e) => onContentInput(e.currentTarget.value)}
                onScroll={onScroll}
                class="absolute inset-0 bg-transparent text-transparent caret-[#cdd6f4] selection:bg-os-accent/40 p-2 resize-none focus:outline-none leading-[20px] overflow-auto whitespace-pre"
                spellcheck={false}
                style={{ "tab-size": "2" }}
              />
            </div>
          }
        >
          <MonacoEditor
            value={activeContent()}
            language={activeTab()?.language ?? "plaintext"}
            onChange={onContentInput}
            onSave={saveActive}
          />
        </Show>
      </div>

      {/* Status bar */}
      <div class="flex items-center h-6 px-3 bg-[#181825] border-t border-[#313244] text-[10px] text-[#6c7086] gap-4">
        <span>{languageLabel(activeTab()?.language ?? "plaintext")}</span>
        <span>UTF-8</span>
        <span>Ln {lineCount()}</span>
        <Show when={activeTab()?.path}>
          <span class="truncate max-w-[280px]">{activeTab()!.path}</span>
        </Show>
        <span class="ml-auto">
          {activeTab() && isModified(activeTab()!) ? "Modified" : "Saved"}
        </span>
      </div>
    </div>
  );

  function RenderTokens() {
    return (
      <For each={tokens()}>
        {(tok) =>
          tok.kind === "newline" ? (
            <span>{"\n"}</span>
          ) : (
            <span class={tokenClass[tok.kind]}>{tok.value}</span>
          )
        }
      </For>
    );
  }
};

export default TextEditor;
