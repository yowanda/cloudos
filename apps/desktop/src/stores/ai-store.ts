import { createSignal } from "solid-js";
import { tryExecuteSlashCommand } from "./ai-tools";

export type AIRole = "user" | "assistant" | "system";

export interface AIMessage {
  id: string;
  role: AIRole;
  content: string;
  timestamp: number;
}

export interface AIConversation {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
}

export type AIProvider = "echo" | "openai" | "anthropic" | "ollama" | "openai-compatible";

export interface AIConfig {
  provider: AIProvider;
  /** Base URL for openai-compatible / ollama. */
  baseUrl: string;
  /** API key (optional for ollama). */
  apiKey: string;
  model: string;
  /** Optional system prompt. */
  systemPrompt: string;
}

const CONV_KEY = "cloudos:ai:conversations";
const CONFIG_KEY = "cloudos:ai:config";

const defaultConfig: AIConfig = {
  provider: "echo",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  systemPrompt: "You are CloudOS Assistant, an AI helper inside a browser-based desktop OS. Be concise and helpful.",
};

function loadConvs(): AIConversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CONV_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as AIConversation[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveConvs(list: AIConversation[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONV_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function loadConfig(): AIConfig {
  if (typeof window === "undefined") return { ...defaultConfig };
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...defaultConfig };
    const partial = JSON.parse(raw) as Partial<AIConfig>;
    return { ...defaultConfig, ...partial };
  } catch {
    return { ...defaultConfig };
  }
}

function saveConfig(c: AIConfig) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
  } catch {
    // ignore
  }
}

const [conversations, setConversations] = createSignal<AIConversation[]>(loadConvs());
const [currentConversationId, setCurrentConversationId] = createSignal<string | null>(
  loadConvs()[0]?.id ?? null,
);
const [config, setConfigInternal] = createSignal<AIConfig>(loadConfig());
const [pending, setPending] = createSignal(false);

export { conversations, currentConversationId, config, pending };

let nextMsg = 1;
let nextConv = 1;

function persistConvs() {
  saveConvs(conversations());
}

export function setConfig(patch: Partial<AIConfig>) {
  const next = { ...config(), ...patch };
  setConfigInternal(next);
  saveConfig(next);
}

export function newConversation(title?: string): AIConversation {
  const id = `conv-${Date.now()}-${nextConv++}`;
  const conv: AIConversation = {
    id,
    title: title ?? "New chat",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  setConversations([conv, ...conversations()]);
  setCurrentConversationId(id);
  persistConvs();
  return conv;
}

export function selectConversation(id: string) {
  setCurrentConversationId(id);
}

export function deleteConversation(id: string) {
  const next = conversations().filter((c) => c.id !== id);
  setConversations(next);
  if (currentConversationId() === id) {
    setCurrentConversationId(next[0]?.id ?? null);
  }
  persistConvs();
}

export function clearConversation(id: string) {
  setConversations(
    conversations().map((c) => (c.id === id ? { ...c, messages: [], updatedAt: Date.now() } : c)),
  );
  persistConvs();
}

export function renameConversation(id: string, title: string) {
  setConversations(
    conversations().map((c) => (c.id === id ? { ...c, title, updatedAt: Date.now() } : c)),
  );
  persistConvs();
}

function appendMessage(convId: string, msg: AIMessage) {
  setConversations(
    conversations().map((c) =>
      c.id === convId
        ? {
            ...c,
            messages: [...c.messages, msg],
            updatedAt: Date.now(),
            title:
              c.title === "New chat" && msg.role === "user"
                ? msg.content.slice(0, 40) + (msg.content.length > 40 ? "…" : "")
                : c.title,
          }
        : c,
    ),
  );
  persistConvs();
}

interface ProviderRequest {
  messages: { role: AIRole; content: string }[];
  config: AIConfig;
  signal: AbortSignal;
}

async function callOpenAICompatible(req: ProviderRequest): Promise<string> {
  const url = `${req.config.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (req.config.apiKey) headers.authorization = `Bearer ${req.config.apiKey}`;
  const body = {
    model: req.config.model,
    messages: req.messages,
    stream: false,
  };
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: req.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "(empty response)";
}

async function callOllama(req: ProviderRequest): Promise<string> {
  const url = `${req.config.baseUrl.replace(/\/$/, "")}/api/chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: req.config.model,
      messages: req.messages,
      stream: false,
    }),
    signal: req.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content?.trim() ?? "(empty response)";
}

async function callAnthropic(req: ProviderRequest): Promise<string> {
  const url = `${req.config.baseUrl.replace(/\/$/, "")}/v1/messages`;
  const sys = req.messages.find((m) => m.role === "system")?.content ?? "";
  const others = req.messages.filter((m) => m.role !== "system");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": req.config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: req.config.model,
      system: sys,
      max_tokens: 1024,
      messages: others.map((m) => ({ role: m.role, content: m.content })),
    }),
    signal: req.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  const data = (await res.json()) as { content?: { text?: string }[] };
  return data.content?.map((c) => c.text ?? "").join("").trim() ?? "(empty response)";
}

function echoProvider(req: ProviderRequest): string {
  const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
  const content = lastUser?.content ?? "";
  if (!content) return "Say something to start the conversation.";
  if (/hello|hi|hey/i.test(content)) {
    return "Hello! I'm the CloudOS Assistant running in offline echo mode. Configure a real LLM provider in the Settings tab to enable smart replies.";
  }
  if (/help|what can/i.test(content)) {
    return [
      "I'm in echo mode (no external LLM connected). Things you can try:",
      "1. Open the Settings tab and pick a provider (OpenAI / Anthropic / Ollama / OpenAI-compatible).",
      "2. Paste an API key (kept local in your browser) and a model name.",
      "3. Send a real message — I'll forward it to the configured endpoint.",
    ].join("\n");
  }
  if (/time|date|clock/i.test(content)) {
    return `It is ${new Date().toLocaleString()} on your device.`;
  }
  return `Echo: ${content}`;
}

export interface SendOptions {
  /** Optional override for system prompt. */
  systemPrompt?: string;
}

export async function sendMessage(text: string, opts: SendOptions = {}): Promise<void> {
  if (!text.trim()) return;
  let conv = conversations().find((c) => c.id === currentConversationId());
  if (!conv) {
    conv = newConversation();
  }
  const userMsg: AIMessage = {
    id: `msg-${Date.now()}-${nextMsg++}`,
    role: "user",
    content: text.trim(),
    timestamp: Date.now(),
  };
  appendMessage(conv.id, userMsg);

  // Context-aware slash commands (`/read`, `/ls`, `/find`, …) bypass the
  // configured LLM provider entirely — they're handled by the local
  // rule-based tool layer in `ai-tools.ts`. This means the Assistant has
  // useful read-only powers (peeking at VFS files, listing windows /
  // apps, checking storage usage) in every mode, including offline echo.
  // See src/stores/ai-tools.ts for the full command list.
  const tool = await tryExecuteSlashCommand(text);
  if (tool.handled) {
    appendMessage(conv.id, {
      id: `msg-${Date.now()}-${nextMsg++}`,
      role: "assistant",
      content: tool.reply,
      timestamp: Date.now(),
    });
    return;
  }

  const cfg = config();
  const sys = opts.systemPrompt ?? cfg.systemPrompt;
  const history: { role: AIRole; content: string }[] = [];
  if (sys) history.push({ role: "system", content: sys });
  // Re-read messages after user append
  const updated = conversations().find((c) => c.id === conv!.id);
  for (const m of updated?.messages ?? []) {
    history.push({ role: m.role, content: m.content });
  }

  const controller = new AbortController();
  setPending(true);
  try {
    let reply: string;
    const req: ProviderRequest = { messages: history, config: cfg, signal: controller.signal };
    switch (cfg.provider) {
      case "openai":
      case "openai-compatible":
        reply = await callOpenAICompatible(req);
        break;
      case "ollama":
        reply = await callOllama(req);
        break;
      case "anthropic":
        reply = await callAnthropic(req);
        break;
      case "echo":
      default:
        reply = echoProvider(req);
    }
    appendMessage(conv.id, {
      id: `msg-${Date.now()}-${nextMsg++}`,
      role: "assistant",
      content: reply,
      timestamp: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    appendMessage(conv.id, {
      id: `msg-${Date.now()}-${nextMsg++}`,
      role: "assistant",
      content: `⚠️ Provider error: ${message}`,
      timestamp: Date.now(),
    });
  } finally {
    setPending(false);
  }
}
