import { Component, For, Show, createMemo, createSignal } from "solid-js";
import {
  config,
  conversations,
  currentConversationId,
  deleteConversation,
  newConversation,
  pending,
  renameConversation,
  selectConversation,
  sendMessage,
  setConfig,
  type AIProvider,
} from "../stores/ai-store";

const providerLabels: Record<AIProvider, string> = {
  echo: "Echo (offline mock)",
  openai: "OpenAI",
  "openai-compatible": "OpenAI-compatible",
  ollama: "Ollama (local)",
  anthropic: "Anthropic Claude",
};

const presetBaseUrls: Record<AIProvider, string> = {
  echo: "",
  openai: "https://api.openai.com/v1",
  "openai-compatible": "http://localhost:8080/v1",
  ollama: "http://localhost:11434",
  anthropic: "https://api.anthropic.com",
};

const presetModels: Record<AIProvider, string> = {
  echo: "",
  openai: "gpt-4o-mini",
  "openai-compatible": "llama3",
  ollama: "llama3",
  anthropic: "claude-3-5-sonnet-latest",
};

const AIAssistant: Component<{ windowId: string }> = () => {
  const [tab, setTab] = createSignal<"chat" | "settings">("chat");
  const [draft, setDraft] = createSignal("");

  const current = createMemo(() => {
    const id = currentConversationId();
    return conversations().find((c) => c.id === id) ?? null;
  });

  let scrollEl: HTMLDivElement | undefined;
  const scrollToBottom = () => {
    queueMicrotask(() => {
      if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
    });
  };

  const send = async () => {
    const text = draft().trim();
    if (!text || pending()) return;
    setDraft("");
    if (!current()) newConversation();
    await sendMessage(text);
    scrollToBottom();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div class="flex h-full text-xs overflow-hidden">
      {/* Sidebar */}
      <div class="w-48 border-r border-os-border flex flex-col flex-shrink-0">
        <div class="p-2 border-b border-os-border flex gap-1">
          <button
            class="flex-1 px-2 py-1 rounded transition-colors"
            classList={{
              "bg-os-accent text-white": tab() === "chat",
              "hover:bg-os-surface-hover": tab() !== "chat",
            }}
            onClick={() => setTab("chat")}
          >
            💬 Chats
          </button>
          <button
            class="px-2 py-1 rounded transition-colors"
            classList={{
              "bg-os-accent text-white": tab() === "settings",
              "hover:bg-os-surface-hover": tab() !== "settings",
            }}
            onClick={() => setTab("settings")}
            title="Settings"
          >
            ⚙
          </button>
        </div>

        <Show when={tab() === "chat"}>
          <div class="p-2 border-b border-os-border">
            <button
              class="w-full px-2 py-1.5 rounded bg-os-accent text-white hover:bg-os-accent-hover transition-colors text-[11px]"
              onClick={() => {
                newConversation();
                setTab("chat");
              }}
            >
              + New chat
            </button>
          </div>

          <div class="flex-1 overflow-y-auto">
            <Show when={conversations().length > 0} fallback={
              <div class="p-3 text-center text-os-text-muted text-[11px]">
                No conversations yet.
              </div>
            }>
              <For each={conversations()}>
                {(c) => (
                  <div
                    class="group flex items-center gap-1 px-2 py-1.5 cursor-pointer transition-colors border-b border-os-border/50"
                    classList={{
                      "bg-os-accent/15 text-os-accent-hover": currentConversationId() === c.id,
                      "hover:bg-os-surface-hover": currentConversationId() !== c.id,
                    }}
                    onClick={() => selectConversation(c.id)}
                  >
                    <span class="flex-1 truncate text-[11px]">{c.title}</span>
                    <button
                      class="opacity-0 group-hover:opacity-100 hover:text-os-danger transition-all"
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(c.id);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </Show>
      </div>

      {/* Main */}
      <div class="flex-1 flex flex-col min-w-0">
        <Show when={tab() === "chat"} fallback={<SettingsPanel />}>
          {/* Header */}
          <div class="px-3 py-2 border-b border-os-border flex items-center gap-2">
            <span class="text-base">🤖</span>
            <Show when={current()} fallback={
              <span class="text-os-text-muted">CloudOS Assistant</span>
            }>
              {(c) => (
                <input
                  type="text"
                  class="flex-1 bg-transparent border-none outline-none text-os-text font-medium"
                  value={c().title}
                  onChange={(e) => renameConversation(c().id, e.currentTarget.value || "Untitled")}
                />
              )}
            </Show>
            <span class="text-[10px] text-os-text-muted">{providerLabels[config().provider]}</span>
          </div>

          {/* Messages */}
          <div ref={(el) => (scrollEl = el)} class="flex-1 overflow-y-auto p-3 space-y-3">
            <Show
              when={current() && (current()!.messages.length > 0)}
              fallback={
                <div class="h-full flex flex-col items-center justify-center text-center text-os-text-muted px-6">
                  <div class="text-4xl mb-3">🤖</div>
                  <p class="font-medium text-os-text">CloudOS Assistant</p>
                  <p class="text-[11px] mt-1">
                    Pluggable LLM chat. Default provider is the offline <strong>Echo</strong> mock —
                    pick a real provider in the ⚙ Settings tab.
                  </p>
                  <p class="text-[11px] mt-3">
                    Try a slash command — they work in <em>every</em> mode (no API key needed):
                  </p>
                  <div class="text-[10px] mt-1 font-mono leading-relaxed">
                    <code>/help</code> · <code>/ls /Documents</code> · <code>/read /path/to/file</code>
                    <br />
                    <code>/find readme</code> · <code>/storage</code> · <code>/windows</code> · <code>/now</code>
                    <br />
                    <code>/clock</code> · <code>/conflicts</code>
                  </div>
                </div>
              }
            >
              <For each={current()!.messages}>
                {(m) => (
                  <div
                    class="flex gap-2"
                    classList={{
                      "flex-row-reverse": m.role === "user",
                    }}
                  >
                    <div
                      class="w-7 h-7 rounded-full flex items-center justify-center text-base flex-shrink-0"
                      classList={{
                        "bg-os-accent text-white": m.role === "user",
                        "bg-os-surface border border-os-border": m.role === "assistant",
                      }}
                    >
                      {m.role === "user" ? "🙂" : "🤖"}
                    </div>
                    <div
                      class="max-w-[80%] rounded-lg px-3 py-2 whitespace-pre-wrap break-words"
                      classList={{
                        "bg-os-accent text-white": m.role === "user",
                        "bg-os-surface border border-os-border": m.role === "assistant",
                      }}
                    >
                      {m.content}
                    </div>
                  </div>
                )}
              </For>
              <Show when={pending()}>
                <div class="flex gap-2">
                  <div class="w-7 h-7 rounded-full bg-os-surface border border-os-border flex items-center justify-center text-base">
                    🤖
                  </div>
                  <div class="rounded-lg px-3 py-2 bg-os-surface border border-os-border text-os-text-muted">
                    <span class="inline-flex gap-1">
                      <span class="animate-pulse">●</span>
                      <span class="animate-pulse" style={{ "animation-delay": "150ms" }}>●</span>
                      <span class="animate-pulse" style={{ "animation-delay": "300ms" }}>●</span>
                    </span>
                  </div>
                </div>
              </Show>
            </Show>
          </div>

          {/* Composer */}
          <div class="border-t border-os-border p-2 flex items-end gap-2">
            <textarea
              value={draft()}
              onInput={(e) => setDraft(e.currentTarget.value)}
              onKeyDown={onKey}
              placeholder="Ask anything... (Shift+Enter = newline)"
              class="flex-1 resize-none px-3 py-2 rounded-lg bg-os-surface border border-os-border text-xs h-12 max-h-32 focus:outline-none focus:border-os-accent"
            />
            <button
              class="px-3 py-2 rounded-lg bg-os-accent text-white text-[11px] hover:bg-os-accent-hover transition-colors disabled:opacity-30"
              disabled={pending() || !draft().trim()}
              onClick={() => void send()}
            >
              {pending() ? "…" : "Send"}
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
};

const SettingsPanel: Component = () => {
  const cfg = config;
  return (
    <div class="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
      <h2 class="text-sm font-semibold">Provider</h2>
      <div class="grid grid-cols-2 gap-2">
        <For each={Object.entries(providerLabels) as [AIProvider, string][]}>
          {([id, label]) => (
            <button
              class="px-3 py-2 rounded-lg border text-left transition-colors"
              classList={{
                "bg-os-accent text-white border-os-accent": cfg().provider === id,
                "border-os-border hover:bg-os-surface-hover": cfg().provider !== id,
              }}
              onClick={() =>
                setConfig({
                  provider: id,
                  baseUrl: presetBaseUrls[id] || cfg().baseUrl,
                  model: presetModels[id] || cfg().model,
                })
              }
            >
              <div class="font-medium">{label}</div>
              <div class="text-[10px] opacity-80">{presetBaseUrls[id] || "no remote endpoint"}</div>
            </button>
          )}
        </For>
      </div>

      <Show when={cfg().provider !== "echo"}>
        <div class="space-y-2">
          <label class="block">
            <span class="block text-os-text-muted mb-1">Base URL</span>
            <input
              type="text"
              value={cfg().baseUrl}
              onInput={(e) => setConfig({ baseUrl: e.currentTarget.value })}
              class="w-full px-3 py-1.5 rounded bg-os-surface border border-os-border focus:outline-none focus:border-os-accent"
            />
          </label>
          <Show when={cfg().provider !== "ollama"}>
            <label class="block">
              <span class="block text-os-text-muted mb-1">API key</span>
              <input
                type="password"
                value={cfg().apiKey}
                onInput={(e) => setConfig({ apiKey: e.currentTarget.value })}
                placeholder="sk-..."
                class="w-full px-3 py-1.5 rounded bg-os-surface border border-os-border focus:outline-none focus:border-os-accent"
              />
              <span class="block text-[10px] text-os-text-muted mt-1">
                Stored only in your browser's localStorage. Clear browser data to remove.
              </span>
            </label>
          </Show>
          <label class="block">
            <span class="block text-os-text-muted mb-1">Model</span>
            <input
              type="text"
              value={cfg().model}
              onInput={(e) => setConfig({ model: e.currentTarget.value })}
              class="w-full px-3 py-1.5 rounded bg-os-surface border border-os-border focus:outline-none focus:border-os-accent"
            />
          </label>
        </div>
      </Show>

      <label class="block">
        <span class="block text-os-text-muted mb-1">System prompt</span>
        <textarea
          value={cfg().systemPrompt}
          onInput={(e) => setConfig({ systemPrompt: e.currentTarget.value })}
          rows={4}
          class="w-full px-3 py-1.5 rounded bg-os-surface border border-os-border focus:outline-none focus:border-os-accent resize-y"
        />
      </label>

      <p class="text-[10px] text-os-text-muted">
        Echo provider runs entirely in-browser and is useful for offline demos. The other providers
        send your messages directly from the browser to the configured endpoint.
      </p>
    </div>
  );
};

export default AIAssistant;
