/**
 * Monaco editor wrapper (B30 — opt-in via Settings → Editor → "Use Monaco").
 *
 * The whole `monaco-editor` module (~3 MB) is `import()`-ed lazily so the
 * initial bundle stays the same. Vite emits Monaco as a separate chunk
 * that's only fetched when the user actually toggles Monaco on. While
 * loading, this component renders a tiny placeholder; if the dynamic
 * import fails (offline + no service-worker cache, network blocked, …)
 * it gracefully falls back to a plain textarea so the user can still edit.
 *
 * Workers: we wire only the base `editor.worker` via Vite's `?worker`
 * import. Language workers (json, ts, css, html) are intentionally NOT
 * loaded — they each add another ~500 KB chunk and provide IntelliSense
 * we don't yet expose UI for. Monaco falls back to its own internal
 * tokenizers without them, so syntax highlighting still works.
 */

import { Component, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import type { Language } from "../core/syntax";

interface MonacoEditorProps {
  value: string;
  language: Language;
  onChange: (next: string) => void;
  onSave?: () => void;
}

// Map our internal `Language` enum onto Monaco's language IDs. Monaco
// understands `plaintext`, `javascript`, `typescript`, `json`, `html`,
// `css`, `markdown`, `python`, `go`, `rust`, `shell`, `xml`, `yaml`,
// `sql`, `cpp`, `csharp`, `java`, `php`, `ruby`, `swift`, `kotlin`,
// `dart`, `lua` etc. out of the box.
function toMonacoLang(lang: Language): string {
  if (lang === "plaintext") return "plaintext";
  return lang;
}

let workerInstalled = false;
async function installMonacoWorker(): Promise<void> {
  if (workerInstalled) return;
  // Vite's `?worker` syntax produces a constructor that yields a real
  // Worker pointing at the bundled chunk. We attach via the global
  // `MonacoEnvironment` hook Monaco probes on first editor creation.
  const editorWorker = (await import("monaco-editor/esm/vs/editor/editor.worker?worker")).default;
  (self as unknown as { MonacoEnvironment?: { getWorker: () => Worker } }).MonacoEnvironment = {
    getWorker() {
      return new editorWorker();
    },
  };
  workerInstalled = true;
}

const MonacoEditor: Component<MonacoEditorProps> = (props) => {
  let host: HTMLDivElement | undefined;
  const [status, setStatus] = createSignal<"loading" | "ready" | "error">("loading");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let editor: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let monacoNs: any = null;
  let suppressChange = false;

  onMount(async () => {
    if (!host) return;
    try {
      await installMonacoWorker();
      monacoNs = await import("monaco-editor/esm/vs/editor/editor.api");

      // Define a CloudOS-themed dark palette that matches the rest of
      // the desktop app. Done lazily so it's only registered when the
      // editor is actually created.
      monacoNs.editor.defineTheme("cloudos-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: {
          "editor.background": "#1e1e2e",
          "editor.foreground": "#cdd6f4",
          "editorCursor.foreground": "#cdd6f4",
          "editor.lineHighlightBackground": "#2a2b3a",
          "editor.selectionBackground": "#44475a",
          "editorLineNumber.foreground": "#6c7086",
          "editorLineNumber.activeForeground": "#cdd6f4",
        },
      });

      editor = monacoNs.editor.create(host, {
        value: props.value,
        language: toMonacoLang(props.language),
        theme: "cloudos-dark",
        automaticLayout: true,
        minimap: { enabled: false },
        fontFamily: "ui-monospace, Menlo, Monaco, Consolas, monospace",
        fontSize: 13,
        tabSize: 2,
        wordWrap: "off",
        scrollBeyondLastLine: false,
      });

      editor.onDidChangeModelContent(() => {
        if (suppressChange) return;
        props.onChange(editor.getValue());
      });

      // Wire Ctrl/Cmd+S onto the editor's keybinding service so the
      // host-level shortcut handler doesn't have to know Monaco exists.
      editor.addCommand(
        monacoNs.KeyMod.CtrlCmd | monacoNs.KeyCode.KeyS,
        () => props.onSave?.(),
      );

      setStatus("ready");
    } catch (e) {
      console.error("[MonacoEditor] failed to load monaco-editor; falling back to textarea", e);
      setStatus("error");
    }
  });

  // Sync external `value` changes (e.g. switching tabs in TextEditor)
  // back into the Monaco model, while ignoring our own emitted changes
  // to avoid feedback loops.
  createEffect(() => {
    const v = props.value;
    if (!editor) return;
    if (editor.getValue() === v) return;
    suppressChange = true;
    editor.setValue(v);
    suppressChange = false;
  });

  // Sync language changes when the user opens a different file type.
  createEffect(() => {
    const l = props.language;
    if (!editor || !monacoNs) return;
    const model = editor.getModel();
    if (!model) return;
    monacoNs.editor.setModelLanguage(model, toMonacoLang(l));
  });

  onCleanup(() => {
    try {
      editor?.dispose();
    } catch {
      // ignore
    }
    editor = null;
    monacoNs = null;
  });

  return (
    <div class="relative flex-1 overflow-hidden bg-[#1e1e2e]" data-cloudos-editor="1">
      <div ref={host} class="absolute inset-0" />
      {status() === "loading" && (
        <div class="absolute inset-0 flex items-center justify-center text-os-text-muted text-xs pointer-events-none">
          Loading Monaco…
        </div>
      )}
      {status() === "error" && (
        <textarea
          value={props.value}
          onInput={(e) => props.onChange(e.currentTarget.value)}
          class="absolute inset-0 bg-[#1e1e2e] text-[#cdd6f4] caret-[#cdd6f4] selection:bg-os-accent/40 p-2 resize-none focus:outline-none leading-[20px] overflow-auto whitespace-pre"
          spellcheck={false}
          style={{ "tab-size": "2", "font-family": "ui-monospace, Menlo, Monaco, Consolas, monospace", "font-size": "13px" }}
        />
      )}
    </div>
  );
};

export default MonacoEditor;
