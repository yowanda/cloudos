import { Component, For, Show, createEffect, createMemo, createSignal, on, onMount } from "solid-js";
import {
  cancelPendingConfirmation,
  cancelPendingToolCall,
  config,
  conversations,
  currentConversationId,
  deleteConversation,
  newConversation,
  pending,
  renameConversation,
  runPendingConfirmation,
  runPendingToolCall,
  selectConversation,
  sendMessage,
  setConfig,
} from "../stores/ai-store";
import { PROVIDER_PRESETS, findPresetById, type ProviderPreset } from "../stores/ai-provider-presets";
import {
  fetchOllamaTags,
  pickFirstToolCapable,
  supportsToolCalling,
  type OllamaTagModel,
  type OllamaTagsResult,
} from "../stores/ollama-tools";

/**
 * Pick the preset whose `baseUrl` + `providerType` matches the live
 * config — used to seed the dropdown so re-opening Settings shows the
 * preset the user picked last time.
 */
function detectActivePreset(cfg: { provider: string; baseUrl: string }): string {
  const exact = PROVIDER_PRESETS.find(
    (p) => p.providerType === cfg.provider && p.baseUrl === cfg.baseUrl,
  );
  if (exact) return exact.id;
  // Fall back to first preset matching just the provider type — the
  // user may have customised the base URL.
  const byType = PROVIDER_PRESETS.find((p) => p.providerType === cfg.provider);
  if (byType) return byType.id;
  return "echo";
}

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
            <span class="text-[10px] text-os-text-muted">
              {(() => {
                const p = findPresetById(detectActivePreset(config()));
                return p ? `${p.icon} ${p.label}` : config().provider;
              })()}
            </span>
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
                    pick a real provider in the ⚙ Settings tab. Free presets ready to plug in:
                    <strong> Groq, OpenRouter, Gemini, Cerebras, Together, Mistral</strong>,
                    or run fully local with Ollama.
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
                  <p class="text-[11px] mt-3">
                    Mutating commands (confirm before run):
                  </p>
                  <div class="text-[10px] mt-1 font-mono leading-relaxed">
                    ⚠️ <code>/write /path content</code> · <code>/mkdir /path</code>
                    <br />
                    ⚠️ <code>/rm [--hard] /path</code> · <code>/mv /src /dst</code>
                  </div>
                </div>
              }
            >
              <For each={current()!.messages}>
                {(m) => (
                  <Show
                    when={m.role !== "tool"}
                    fallback={
                      <div class="flex gap-2 ml-9">
                        <div class="max-w-[80%] rounded text-[10px] font-mono whitespace-pre-wrap break-words bg-os-surface/50 border border-os-border/40 px-2 py-1 text-os-text-muted">
                          <span class="block text-[9px] uppercase tracking-wide opacity-70 mb-0.5">
                            tool · {m.toolName ?? "(unknown)"}
                          </span>
                          {m.content || "(empty)"}
                        </div>
                      </div>
                    }
                  >
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
                        class="max-w-[80%] rounded-lg px-3 py-2 whitespace-pre-wrap break-words flex flex-col gap-2"
                        classList={{
                          "bg-os-accent text-white": m.role === "user",
                          "bg-os-surface border border-os-border": m.role === "assistant",
                        }}
                      >
                        <Show when={m.content}>
                          <span>{m.content}</span>
                        </Show>
                        {/* Slash-command Run / Cancel gate (legacy single-payload). */}
                        <Show when={m.pendingConfirmation}>
                          <div class="flex flex-col gap-1.5 pt-1.5 border-t border-os-border/60">
                            <span class="text-[10px] text-amber-400">
                              ⚠️ This action mutates your VFS.
                            </span>
                            <div class="flex gap-2">
                              <button
                                type="button"
                                class="px-3 py-1 rounded text-[11px] bg-os-danger text-white hover:opacity-90 transition-opacity"
                                onClick={() => {
                                  const convId = currentConversationId();
                                  if (convId) runPendingConfirmation(convId, m.id);
                                }}
                              >
                                Run
                              </button>
                              <button
                                type="button"
                                class="px-3 py-1 rounded text-[11px] bg-os-surface border border-os-border hover:bg-os-surface-hover transition-colors"
                                onClick={() => {
                                  const convId = currentConversationId();
                                  if (convId) cancelPendingConfirmation(convId, m.id);
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </Show>
                        {/* LLM tool calls (Feature #3). Each call card shows
                            the function + args; dangerous calls render their
                            own Run / Cancel until resolved. */}
                        <Show when={m.toolCalls && m.toolCalls.length > 0}>
                          <div class="flex flex-col gap-1.5 pt-1.5 border-t border-os-border/60">
                            <For each={m.toolCalls}>
                              {(tc) => (
                                <div class="flex flex-col gap-1 rounded bg-os-bg/40 border border-os-border/40 px-2 py-1.5">
                                  <div class="flex items-center gap-1.5 text-[10px] font-mono">
                                    <span class="text-os-accent">{tc.name}</span>
                                    <span class="text-os-text-muted truncate">
                                      ({JSON.stringify(tc.args)})
                                    </span>
                                  </div>
                                  <Show when={tc.confirmation}>
                                    <div class="flex flex-col gap-1">
                                      <span class="text-[10px] text-amber-400">
                                        ⚠️ Mutates VFS — confirm to run.
                                      </span>
                                      <div class="flex gap-2">
                                        <button
                                          type="button"
                                          class="px-2 py-0.5 rounded text-[10px] bg-os-danger text-white hover:opacity-90 transition-opacity"
                                          onClick={() => {
                                            const convId = currentConversationId();
                                            if (convId) runPendingToolCall(convId, m.id, tc.id);
                                          }}
                                        >
                                          Run
                                        </button>
                                        <button
                                          type="button"
                                          class="px-2 py-0.5 rounded text-[10px] bg-os-surface border border-os-border hover:bg-os-surface-hover transition-colors"
                                          onClick={() => {
                                            const convId = currentConversationId();
                                            if (convId) cancelPendingToolCall(convId, m.id, tc.id);
                                          }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  </Show>
                                  <Show when={tc.result !== undefined}>
                                    <div
                                      class="text-[10px] font-mono whitespace-pre-wrap break-words text-os-text-muted"
                                      classList={{ "text-amber-400": tc.cancelled }}
                                    >
                                      {tc.result}
                                    </div>
                                  </Show>
                                </div>
                              )}
                            </For>
                          </div>
                        </Show>
                      </div>
                    </div>
                  </Show>
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
  const activePresetId = createMemo(() => detectActivePreset(cfg()));
  const activePreset = createMemo<ProviderPreset>(
    () => findPresetById(activePresetId()) ?? PROVIDER_PRESETS[0],
  );
  const isOllama = createMemo(() => activePresetId() === "ollama");

  const applyPreset = (preset: ProviderPreset) => {
    setConfig({
      provider: preset.providerType,
      baseUrl: preset.baseUrl,
      model: preset.defaultModel,
    });
  };

  const [ollamaProbe, setOllamaProbe] = createSignal<OllamaTagsResult | null>(null);
  const [probing, setProbing] = createSignal(false);
  const refreshOllamaTags = async () => {
    if (!isOllama()) return;
    setProbing(true);
    try {
      const res = await fetchOllamaTags(cfg().baseUrl);
      setOllamaProbe(res);
      if (res.ok) {
        const installed = new Set(res.models.map((m) => m.name));
        if (!installed.has(cfg().model)) {
          const fallback = pickFirstToolCapable(res.models) ?? res.models[0];
          if (fallback) setConfig({ model: fallback.name });
        }
      }
    } finally {
      setProbing(false);
    }
  };

  onMount(() => {
    if (isOllama()) void refreshOllamaTags();
  });
  createEffect(
    on(
      () => [isOllama(), cfg().baseUrl] as const,
      ([on, _url], prev) => {
        if (!on) {
          setOllamaProbe(null);
          return;
        }
        if (!prev || !prev[0] || prev[1] !== _url) {
          void refreshOllamaTags();
        }
      },
    ),
  );

  const ollamaModels = createMemo<OllamaTagModel[]>(() => {
    const r = ollamaProbe();
    return r?.ok ? r.models : [];
  });
  const selectedSupportsTools = createMemo(() => supportsToolCalling(cfg().model));

  return (
    <div class="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
      <h2 class="text-sm font-semibold">Provider</h2>
      <p class="text-[10px] text-os-text-muted">
        Pick a preset to auto-fill base URL + model. Most providers are <strong>free</strong> after
        signup — click the link inside each preset to grab a key. Your key is stored only in this
        browser's localStorage and is never sent anywhere except the configured endpoint.
      </p>

      {/* Preset dropdown — most-relevant view */}
      <label class="block">
        <span class="block text-os-text-muted mb-1">Quick start preset</span>
        <select
          class="w-full px-3 py-1.5 rounded bg-os-surface border border-os-border focus:outline-none focus:border-os-accent"
          value={activePresetId()}
          onChange={(e) => {
            const p = findPresetById(e.currentTarget.value);
            if (p) applyPreset(p);
          }}
        >
          <For each={PROVIDER_PRESETS}>
            {(p) => (
              <option value={p.id}>
                {p.icon} {p.label}
                {p.requiresKey ? "" : " — no key needed"}
              </option>
            )}
          </For>
        </select>
        <span class="block text-[10px] text-os-text-muted mt-1">{activePreset().description}</span>
      </label>

      <Show when={activePreset().signupUrl}>
        <a
          href={activePreset().signupUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-block px-3 py-1.5 rounded bg-os-accent text-white text-[11px] hover:bg-os-accent-hover transition-colors"
        >
          {activePreset().requiresKey ? "Get free API key →" : "Open download / signup page →"}
        </a>
      </Show>

      <Show when={activePreset().providerType !== "echo"}>
        <div class="space-y-2">
          <label class="block">
            <span class="block text-os-text-muted mb-1">Base URL</span>
            <input
              type="text"
              value={cfg().baseUrl}
              onInput={(e) => setConfig({ baseUrl: e.currentTarget.value })}
              class="w-full px-3 py-1.5 rounded bg-os-surface border border-os-border focus:outline-none focus:border-os-accent font-mono"
            />
          </label>

          <Show when={activePreset().requiresKey}>
            <label class="block">
              <span class="block text-os-text-muted mb-1">API key</span>
              <input
                type="password"
                value={cfg().apiKey}
                onInput={(e) => setConfig({ apiKey: e.currentTarget.value })}
                placeholder="sk-... / your-api-key"
                class="w-full px-3 py-1.5 rounded bg-os-surface border border-os-border focus:outline-none focus:border-os-accent font-mono"
              />
              <span class="block text-[10px] text-os-text-muted mt-1">
                Stored only in your browser's localStorage. Clear browser data to remove. Not synced
                to the CloudOS backend.
              </span>
            </label>
          </Show>

          <label class="block">
            <span class="flex items-center justify-between text-os-text-muted mb-1">
              <span>Model</span>
              <Show when={isOllama()}>
                <button
                  type="button"
                  class="text-[10px] px-2 py-0.5 rounded bg-os-surface border border-os-border hover:bg-os-surface-hover transition-colors disabled:opacity-50"
                  disabled={probing()}
                  onClick={() => void refreshOllamaTags()}
                  title="Re-fetch installed models from Ollama"
                >
                  {probing() ? "Probing…" : "↻ Refresh installed"}
                </button>
              </Show>
            </span>
            <Show
              when={activePreset().suggestedModels.length > 0 || isOllama()}
              fallback={
                <input
                  type="text"
                  value={cfg().model}
                  onInput={(e) => setConfig({ model: e.currentTarget.value })}
                  class="w-full px-3 py-1.5 rounded bg-os-surface border border-os-border focus:outline-none focus:border-os-accent font-mono"
                />
              }
            >
              <select
                class="w-full px-3 py-1.5 rounded bg-os-surface border border-os-border focus:outline-none focus:border-os-accent font-mono"
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  if (v === "__custom__") return;
                  setConfig({ model: v });
                }}
              >
                <Show
                  when={isOllama() && ollamaModels().length > 0}
                  fallback={
                    <For each={activePreset().suggestedModels}>
                      {(m) => (
                        <option value={m} selected={cfg().model === m}>
                          {m}
                        </option>
                      )}
                    </For>
                  }
                >
                  <For each={ollamaModels()}>
                    {(m) => (
                      <option value={m.name} selected={cfg().model === m.name}>
                        {supportsToolCalling(m.name) ? "🛠️ " : "      "}
                        {m.name}
                        {" — "}
                        {m.details.parameter_size}
                      </option>
                    )}
                  </For>
                </Show>
                <option
                  value="__custom__"
                  selected={
                    isOllama()
                      ? !ollamaModels().some((m) => m.name === cfg().model) &&
                        !activePreset().suggestedModels.includes(cfg().model)
                      : !activePreset().suggestedModels.includes(cfg().model)
                  }
                >
                  — custom (type below) —
                </option>
              </select>
              <input
                type="text"
                value={cfg().model}
                onInput={(e) => setConfig({ model: e.currentTarget.value })}
                placeholder="Override with any model id..."
                class="w-full px-3 py-1.5 mt-1 rounded bg-os-surface border border-os-border focus:outline-none focus:border-os-accent font-mono text-[11px]"
              />
            </Show>

            <Show when={isOllama()}>
              <Show when={ollamaProbe()?.ok}>
                <span class="block text-[10px] text-os-text-muted mt-1">
                  {ollamaModels().length} installed model
                  {ollamaModels().length === 1 ? "" : "s"} detected.{" "}
                  <span class="text-os-text">🛠️</span> = supports tool-calling.
                </span>
              </Show>
              <Show when={ollamaProbe() && !ollamaProbe()!.ok}>
                <span class="block text-[10px] text-amber-400 mt-1">
                  Couldn't reach Ollama: {(ollamaProbe() as { error: string }).error}.{" "}
                  {(ollamaProbe() as { hint: string }).hint} Falling back to the curated suggested
                  list.
                </span>
              </Show>
              <Show when={cfg().model && !selectedSupportsTools()}>
                <span class="block text-[10px] text-amber-400 mt-1">
                  ⚠️ <span class="font-mono">{cfg().model}</span> isn't on the known
                  tool-calling list. Tool calls may be ignored or hallucinated. Recommended:
                  llama3.1, qwen2.5, mistral-nemo, hermes3, command-r.
                </span>
              </Show>
            </Show>
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

      <h2 class="text-sm font-semibold pt-2">Tool calling</h2>
      <label class="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          class="mt-0.5"
          checked={cfg().toolCallingEnabled}
          onChange={(e) => setConfig({ toolCallingEnabled: e.currentTarget.checked })}
        />
        <span class="text-[11px]">
          <span class="block text-os-text">Let the LLM call CloudOS tools</span>
          <span class="block text-os-text-muted mt-0.5">
            When on, OpenAI / OpenAI-compatible / tool-capable Ollama models receive the
            CloudOS tools schema and may invoke <code>read_file</code>, <code>list_dir</code>,
            <code>write_file</code>, etc. directly. Mutating tools still go through the same
            confirmation gate as slash commands. Anthropic support arrives in the next batch.
          </span>
        </span>
      </label>

      <h2 class="text-sm font-semibold pt-2">Dangerous commands</h2>
      <label class="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          class="mt-0.5"
          checked={cfg().dangerousAlwaysAllow}
          onChange={(e) => setConfig({ dangerousAlwaysAllow: e.currentTarget.checked })}
        />
        <span class="text-[11px]">
          <span class="block text-os-text">Always allow dangerous commands</span>
          <span class="block text-os-text-muted mt-0.5">
            When off (default), <code>/write</code>, <code>/mkdir</code>, <code>/rm</code>, and
            <code>/mv</code> show a Run / Cancel button in chat and wait for confirmation. When
            on, they mutate the VFS immediately — convenient for power users, easy to misfire.
            Also applies to dangerous LLM tool calls when tool calling is on above.
          </span>
        </span>
      </label>

      <p class="text-[10px] text-os-text-muted">
        Echo and Ollama run without external network calls (Ollama runs locally on your machine).
        All other providers send your prompts directly from this browser to the configured
        endpoint. Slash commands (<code>/help</code>, <code>/read</code>, <code>/ls</code>,
        <code>/conflicts</code>, …) work in every mode and never invoke the LLM.
      </p>
    </div>
  );
};

export default AIAssistant;
