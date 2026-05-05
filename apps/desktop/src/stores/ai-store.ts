import { createSignal } from "solid-js";
import {
  type ConfirmationPayload,
  describeConfirmation,
  executeConfirmedAction,
  getToolsSchema,
  runTool,
  tryExecuteSlashCommand,
} from "./ai-tools";
import { supportsToolCalling } from "./ollama-tools";

export type AIRole = "user" | "assistant" | "system" | "tool";

/**
 * One LLM-emitted tool call, captured on an assistant message. Each
 * call moves through one of three terminal states:
 *   - `result` set, `confirmation` undefined, `cancelled` falsy
 *       — read-only or already-allowed mutating call, executed
 *   - `confirmation` set, `result` undefined
 *       — dangerous mutating call queued behind Run / Cancel
 *   - `cancelled: true`, `result` set to a cancellation notice
 *       — user clicked Cancel
 *
 * Once every call on a message reaches a terminal state with `result`
 * populated (i.e. no pending confirmations), the multi-turn loop is
 * resumed via `resumeAfterToolConfirmation`.
 */
export interface ToolCallInvocation {
  /** Provider-issued id (used to match the `tool` result message back). */
  id: string;
  /** Tool name as registered in `ai-tools.tools`. */
  name: string;
  /** Parsed JSON params object. */
  args: Record<string, unknown>;
  /** Tool result text once the call is resolved. */
  result?: string;
  /** Set when the call is dangerous and waiting for Run / Cancel. */
  confirmation?: ConfirmationPayload;
  /** True if the user clicked Cancel rather than Run. */
  cancelled?: boolean;
}

export interface AIMessage {
  id: string;
  role: AIRole;
  content: string;
  timestamp: number;
  /**
   * Set on assistant messages whose body is a preview of a queued
   * dangerous mutation (`/write`, `/mkdir`, `/rm`, `/mv`). The chat
   * UI renders Run / Cancel buttons until the user resolves it via
   * `runPendingConfirmation` or `cancelPendingConfirmation`.
   */
  pendingConfirmation?: ConfirmationPayload;
  /**
   * Set on assistant messages where the LLM emitted structured tool
   * calls (function-calling). The UI renders the call list and
   * per-call Run / Cancel for any dangerous call still pending.
   */
  toolCalls?: ToolCallInvocation[];
  /** Set on `tool` role messages — the call id this result answers. */
  toolCallId?: string;
  /** Set on `tool` role messages — the tool name (for UI labelling). */
  toolName?: string;
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
  /**
   * When true, the dangerous slash commands (`/write`, `/mkdir`, `/rm`,
   * `/mv`) skip the Run / Cancel confirmation gate and run their
   * mutation immediately. Default off — the gate is the safer choice.
   * Also applies to dangerous LLM tool calls.
   */
  dangerousAlwaysAllow: boolean;
  /**
   * When true, OpenAI / OpenAI-compatible / Anthropic / tool-capable
   * Ollama providers are sent the CloudOS tools schema and the response
   * is parsed for tool calls. Multi-turn (LLM → tool → LLM) up to
   * `TOOL_CALL_MAX_ITERATIONS` rounds. Default off because not every
   * model honours tools correctly. Echo always ignores this flag.
   */
  toolCallingEnabled: boolean;
}

const CONV_KEY = "cloudos:ai:conversations";
const CONFIG_KEY = "cloudos:ai:config";

const defaultConfig: AIConfig = {
  provider: "echo",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  systemPrompt:
    "You are CloudOS Assistant, an AI helper inside a browser-based desktop OS. Be concise and helpful.",
  dangerousAlwaysAllow: false,
  toolCallingEnabled: false,
};

/** Hard cap on LLM → tool → LLM round-trips per user message. */
const TOOL_CALL_MAX_ITERATIONS = 5;

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

/**
 * Replace a single message in-place with the supplied patch fields and
 * persist. Used by the Run / Cancel confirmation flow to swap the
 * preview text for the outcome text without touching surrounding
 * messages.
 */
function patchMessage(convId: string, msgId: string, patch: Partial<AIMessage>) {
  setConversations(
    conversations().map((c) =>
      c.id === convId
        ? {
            ...c,
            messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
            updatedAt: Date.now(),
          }
        : c,
    ),
  );
  persistConvs();
}

/**
 * Apply the queued mutation attached to an assistant message and
 * replace its body with the outcome text. Clears
 * `pendingConfirmation` so the Run / Cancel buttons disappear.
 */
export function runPendingConfirmation(convId: string, msgId: string) {
  const conv = conversations().find((c) => c.id === convId);
  const msg = conv?.messages.find((m) => m.id === msgId);
  if (!msg?.pendingConfirmation) return;
  const payload = msg.pendingConfirmation;
  let outcome: string;
  try {
    outcome = executeConfirmedAction(payload);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    outcome = `Failed to apply confirmed action: ${m}`;
  }
  patchMessage(convId, msgId, { content: outcome, pendingConfirmation: undefined });
}

/**
 * Discard a queued mutation without touching the VFS, replacing the
 * preview body with a "Cancelled" notice.
 */
export function cancelPendingConfirmation(convId: string, msgId: string) {
  const conv = conversations().find((c) => c.id === convId);
  const msg = conv?.messages.find((m) => m.id === msgId);
  if (!msg?.pendingConfirmation) return;
  patchMessage(convId, msgId, {
    content: "Cancelled — no changes made.",
    pendingConfirmation: undefined,
  });
}

/**
 * Provider-agnostic chat message wire format. The OpenAI / Ollama
 * `/chat/completions` and `/api/chat` endpoints accept this verbatim;
 * Anthropic needs a small adapter (system pulled out, role names mapped),
 * which is handled in `callAnthropic`.
 */
interface WireMessage {
  role: AIRole;
  content: string;
  /** OpenAI-style: present on assistant messages with tool calls. */
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
  /** OpenAI-style: present on `tool` role messages. */
  tool_call_id?: string;
  /** OpenAI-style: present on `tool` role messages (some providers). */
  name?: string;
}

interface ProviderRequest {
  messages: WireMessage[];
  config: AIConfig;
  signal: AbortSignal;
  /** When true, send `tools[]` (OpenAI/Ollama) and parse `tool_calls`. */
  withTools: boolean;
}

/**
 * Either a plain assistant text reply or a request from the LLM to
 * invoke one or more tools. `text` is empty (or accompanied by
 * `toolCalls`) when the model wants to call functions.
 */
interface ProviderResponse {
  text: string;
  toolCalls?: ToolCallInvocation[];
}

/**
 * Parse `arguments` from an OpenAI-style tool call (always a JSON
 * string per the spec) into a typed object. Bad JSON → empty object
 * (the tool's run() will surface a friendlier validation error).
 */
function parseToolArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function callOpenAICompatible(req: ProviderRequest): Promise<ProviderResponse> {
  const url = `${req.config.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (req.config.apiKey) headers.authorization = `Bearer ${req.config.apiKey}`;
  const body: Record<string, unknown> = {
    model: req.config.model,
    messages: req.messages,
    stream: false,
  };
  if (req.withTools) {
    body.tools = getToolsSchema();
    body.tool_choice = "auto";
  }
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
    choices?: {
      message?: {
        content?: string | null;
        tool_calls?: {
          id?: string;
          type?: string;
          function?: { name?: string; arguments?: string };
        }[];
      };
    }[];
  };
  const message = data.choices?.[0]?.message;
  const text = message?.content?.trim() ?? "";
  const rawCalls = message?.tool_calls ?? [];
  if (rawCalls.length === 0) {
    return { text: text || "(empty response)" };
  }
  const toolCalls: ToolCallInvocation[] = rawCalls
    .filter((c) => c.function?.name)
    .map((c, i) => ({
      id: c.id ?? `call-${i}`,
      name: c.function?.name ?? "",
      args: parseToolArgs(c.function?.arguments),
    }));
  return { text, toolCalls };
}

async function callOllama(req: ProviderRequest): Promise<ProviderResponse> {
  const url = `${req.config.baseUrl.replace(/\/$/, "")}/api/chat`;
  const body: Record<string, unknown> = {
    model: req.config.model,
    messages: req.messages,
    stream: false,
  };
  // Ollama copies OpenAI's tools[] shape verbatim on /api/chat. Only
  // send tools when the user opted in AND the installed model is on
  // the known-tool-capable allow-list (`ollama-tools.ts`).
  if (req.withTools && supportsToolCalling(req.config.model)) {
    body.tools = getToolsSchema();
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: req.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  const data = (await res.json()) as {
    message?: {
      content?: string;
      tool_calls?: {
        function?: { name?: string; arguments?: Record<string, unknown> | string };
      }[];
    };
  };
  const text = data.message?.content?.trim() ?? "";
  const rawCalls = data.message?.tool_calls ?? [];
  if (rawCalls.length === 0) {
    return { text: text || "(empty response)" };
  }
  // Ollama returns `arguments` as an already-parsed object on most
  // models, but a string on a few — normalise both.
  const toolCalls: ToolCallInvocation[] = rawCalls
    .filter((c) => c.function?.name)
    .map((c, i) => {
      const rawArgs = c.function?.arguments;
      const args =
        typeof rawArgs === "string"
          ? parseToolArgs(rawArgs)
          : rawArgs && typeof rawArgs === "object"
            ? (rawArgs as Record<string, unknown>)
            : {};
      return {
        id: `ollama-call-${Date.now()}-${i}`,
        name: c.function?.name ?? "",
        args,
      };
    });
  return { text, toolCalls };
}

/**
 * Anthropic content block — text or tool_use on assistant turns,
 * tool_result on user turns. We hand-roll this rather than pulling
 * in `@anthropic-ai/sdk` because the wire shape is small and stable
 * and we don't want the bundle bloat in this PWA.
 */
type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

/**
 * Translate the OpenAI-shaped wire messages into Anthropic's content-block
 * format. Tool results land as `user` messages with a `tool_result` block;
 * assistant turns with tool calls land as content arrays mixing `text`
 * and `tool_use` blocks.
 */
function wireToAnthropic(messages: WireMessage[]): AnthropicMessage[] {
  const out: AnthropicMessage[] = [];
  for (const m of messages) {
    if (m.role === "system") continue; // pulled out into the top-level `system` field
    if (m.role === "tool") {
      out.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: m.tool_call_id ?? "",
            content: m.content,
          },
        ],
      });
      continue;
    }
    if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
      const blocks: AnthropicContentBlock[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of m.tool_calls) {
        let input: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(tc.function.arguments || "{}");
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            input = parsed as Record<string, unknown>;
          }
        } catch {
          input = {};
        }
        blocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input,
        });
      }
      out.push({ role: "assistant", content: blocks });
      continue;
    }
    out.push({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    });
  }
  return out;
}

async function callAnthropic(req: ProviderRequest): Promise<ProviderResponse> {
  const url = `${req.config.baseUrl.replace(/\/$/, "")}/v1/messages`;
  const sys = req.messages.find((m) => m.role === "system")?.content ?? "";
  const messages = wireToAnthropic(req.messages);
  const body: Record<string, unknown> = {
    model: req.config.model,
    system: sys,
    max_tokens: 1024,
    messages,
  };
  if (req.withTools) {
    // Anthropic's tools[] uses { name, description, input_schema } —
    // the inner schema is the same JSON schema we ship to OpenAI.
    body.tools = getToolsSchema().map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": req.config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal: req.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  const data = (await res.json()) as {
    content?: (
      | { type: "text"; text?: string }
      | { type: "tool_use"; id?: string; name?: string; input?: Record<string, unknown> }
    )[];
    stop_reason?: string;
  };
  const blocks = data.content ?? [];
  const text = blocks
    .filter((b): b is { type: "text"; text?: string } => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
  const toolUses = blocks.filter(
    (b): b is { type: "tool_use"; id?: string; name?: string; input?: Record<string, unknown> } =>
      b.type === "tool_use",
  );
  if (toolUses.length === 0) {
    return { text: text || "(empty response)" };
  }
  const toolCalls: ToolCallInvocation[] = toolUses
    .filter((b) => b.name)
    .map((b, i) => ({
      id: b.id ?? `anth-call-${Date.now()}-${i}`,
      name: b.name ?? "",
      args: b.input && typeof b.input === "object" ? b.input : {},
    }));
  return { text, toolCalls };
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

/**
 * Build the wire-format messages array from a conversation. We strip
 * `pendingConfirmation` / `toolCalls` / etc. metadata fields and emit
 * just the role + content (+ tool_call wiring for assistant / tool
 * messages). System prompt is always first when present.
 */
function buildWireMessages(
  systemPrompt: string,
  messages: AIMessage[],
): WireMessage[] {
  const wire: WireMessage[] = [];
  if (systemPrompt) wire.push({ role: "system", content: systemPrompt });
  for (const m of messages) {
    if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
      wire.push({
        role: "assistant",
        content: m.content || "",
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
        })),
      });
      continue;
    }
    if (m.role === "tool") {
      wire.push({
        role: "tool",
        content: m.content,
        tool_call_id: m.toolCallId,
        name: m.toolName,
      });
      continue;
    }
    wire.push({ role: m.role, content: m.content });
  }
  return wire;
}

/**
 * Whether the configured provider supports tool-calling. OpenAI /
 * OpenAI-compatible / Anthropic always support it; Ollama only when
 * the configured model is on the known-tool-capable allow-list. Echo
 * never supports it (no LLM).
 */
function providerSupportsTools(cfg: AIConfig): boolean {
  if (!cfg.toolCallingEnabled) return false;
  switch (cfg.provider) {
    case "openai":
    case "openai-compatible":
    case "anthropic":
      return true;
    case "ollama":
      return supportsToolCalling(cfg.model);
    default:
      return false;
  }
}

async function dispatchProvider(req: ProviderRequest): Promise<ProviderResponse> {
  switch (req.config.provider) {
    case "openai":
    case "openai-compatible":
      return callOpenAICompatible(req);
    case "ollama":
      return callOllama(req);
    case "anthropic":
      return callAnthropic(req);
    case "echo":
    default:
      return { text: echoProvider(req) };
  }
}

/**
 * Execute one tool call against the live VFS / desktop state, gating
 * dangerous calls behind the configured `dangerousAlwaysAllow` flag.
 * Mutates `tc` in place: writes either `result` or `confirmation`.
 */
async function resolveToolCall(tc: ToolCallInvocation, cfg: AIConfig): Promise<void> {
  const out = await runTool(tc.name, tc.args, { alwaysAllow: cfg.dangerousAlwaysAllow });
  if (out.confirmation) {
    tc.confirmation = out.confirmation;
  } else {
    tc.result = out.content;
  }
}

/** True iff every tool call on a message has reached a terminal state. */
function allCallsResolved(calls: ToolCallInvocation[]): boolean {
  return calls.every((c) => c.result !== undefined || c.cancelled === true);
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
  // Mutating commands (`/write`, `/mkdir`, `/rm`, `/mv`) attach a
  // `pendingConfirmation` payload to the assistant message so the chat
  // UI can render Run / Cancel — unless `dangerousAlwaysAllow` is on,
  // in which case they execute immediately. See ai-tools.ts.
  const cfg = config();
  const tool = await tryExecuteSlashCommand(text, {
    alwaysAllow: cfg.dangerousAlwaysAllow,
  });
  if (tool.handled) {
    const previewBody = tool.confirmation
      ? describeConfirmation(tool.confirmation)
      : tool.reply;
    appendMessage(conv.id, {
      id: `msg-${Date.now()}-${nextMsg++}`,
      role: "assistant",
      content: previewBody,
      timestamp: Date.now(),
      pendingConfirmation: tool.confirmation,
    });
    return;
  }

  const sys = opts.systemPrompt ?? cfg.systemPrompt;
  const controller = new AbortController();
  setPending(true);
  try {
    await runProviderLoop(conv.id, sys, cfg, controller.signal);
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

/**
 * Drive the LLM \u2194 tool round-trip loop. Returns when the LLM produces
 * a plain text reply, when a dangerous tool call is queued behind
 * Run / Cancel (loop will be resumed by `resumeAfterToolConfirmation`),
 * or when `TOOL_CALL_MAX_ITERATIONS` is hit.
 */
async function runProviderLoop(
  convId: string,
  systemPrompt: string,
  cfg: AIConfig,
  signal: AbortSignal,
): Promise<void> {
  const withTools = providerSupportsTools(cfg);
  for (let iteration = 0; iteration < TOOL_CALL_MAX_ITERATIONS; iteration++) {
    // Re-read the conversation each iteration so the latest tool
    // result messages are picked up.
    const conv = conversations().find((c) => c.id === convId);
    if (!conv) return;
    const wire = buildWireMessages(systemPrompt, conv.messages);
    const req: ProviderRequest = { messages: wire, config: cfg, signal, withTools };
    const resp = await dispatchProvider(req);

    // Plain text reply — append and we're done.
    if (!resp.toolCalls || resp.toolCalls.length === 0) {
      appendMessage(convId, {
        id: `msg-${Date.now()}-${nextMsg++}`,
        role: "assistant",
        content: resp.text || "(empty response)",
        timestamp: Date.now(),
      });
      return;
    }

    // Resolve every tool call against the live state. Read-only and
    // already-allowed mutating calls execute immediately; dangerous
    // calls without `dangerousAlwaysAllow` come back with a
    // `confirmation` payload and stop the loop.
    for (const tc of resp.toolCalls) {
      await resolveToolCall(tc, cfg);
    }

    const previewLines = resp.toolCalls.map((tc) => `\u2192 ${tc.name}(${JSON.stringify(tc.args)})`);
    const previewBody =
      (resp.text ? `${resp.text}\n\n` : "") + previewLines.join("\n");
    const assistantMsgId = `msg-${Date.now()}-${nextMsg++}`;
    appendMessage(convId, {
      id: assistantMsgId,
      role: "assistant",
      content: previewBody,
      timestamp: Date.now(),
      toolCalls: resp.toolCalls,
    });

    if (!allCallsResolved(resp.toolCalls)) {
      // At least one dangerous call is queued behind Run / Cancel.
      // Stop here \u2014 the user will resume via the chat UI.
      return;
    }

    // All resolved \u2014 append tool result messages and loop again so
    // the LLM can react to them.
    for (const tc of resp.toolCalls) {
      appendMessage(convId, {
        id: `msg-${Date.now()}-${nextMsg++}`,
        role: "tool",
        content: tc.result ?? "",
        timestamp: Date.now(),
        toolCallId: tc.id,
        toolName: tc.name,
      });
    }
  }

  // Hit the iteration cap \u2014 surface a warning so the user knows the
  // model would have kept calling tools indefinitely.
  appendMessage(convId, {
    id: `msg-${Date.now()}-${nextMsg++}`,
    role: "assistant",
    content: `\u26a0\ufe0f Tool-call iteration cap reached (${TOOL_CALL_MAX_ITERATIONS}). Stopping to avoid a runaway loop.`,
    timestamp: Date.now(),
  });
}

/**
 * After the user resolves the last pending Run / Cancel on a message
 * carrying `toolCalls`, append tool result messages and re-enter the
 * provider loop so the LLM can react to the outcomes.
 */
async function resumeAfterToolCalls(convId: string, msgId: string): Promise<void> {
  const conv = conversations().find((c) => c.id === convId);
  const msg = conv?.messages.find((m) => m.id === msgId);
  if (!msg?.toolCalls || !allCallsResolved(msg.toolCalls)) return;

  // Append tool result messages corresponding to this assistant turn.
  for (const tc of msg.toolCalls) {
    appendMessage(convId, {
      id: `msg-${Date.now()}-${nextMsg++}`,
      role: "tool",
      content: tc.result ?? "",
      timestamp: Date.now(),
      toolCallId: tc.id,
      toolName: tc.name,
    });
  }

  const cfg = config();
  const sys = cfg.systemPrompt;
  const controller = new AbortController();
  setPending(true);
  try {
    await runProviderLoop(convId, sys, cfg, controller.signal);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    appendMessage(convId, {
      id: `msg-${Date.now()}-${nextMsg++}`,
      role: "assistant",
      content: `⚠️ Provider error: ${message}`,
      timestamp: Date.now(),
    });
  } finally {
    setPending(false);
  }
}

/**
 * Resolve a single tool call inside an assistant message. If this was
 * the last pending call, kicks off `resumeAfterToolCalls` so the LLM
 * can see the outcome and continue the conversation.
 */
function patchToolCall(
  convId: string,
  msgId: string,
  callId: string,
  patch: Partial<ToolCallInvocation>,
): boolean {
  let resolvedAll = false;
  setConversations(
    conversations().map((c) => {
      if (c.id !== convId) return c;
      return {
        ...c,
        messages: c.messages.map((m) => {
          if (m.id !== msgId || !m.toolCalls) return m;
          const nextCalls = m.toolCalls.map((tc) =>
            tc.id === callId ? { ...tc, ...patch } : tc,
          );
          if (allCallsResolved(nextCalls)) resolvedAll = true;
          return { ...m, toolCalls: nextCalls };
        }),
        updatedAt: Date.now(),
      };
    }),
  );
  persistConvs();
  return resolvedAll;
}

/**
 * User clicked Run on a dangerous LLM tool call. Apply the mutation
 * and (if this was the last pending call on the message) resume the
 * multi-turn loop.
 */
export function runPendingToolCall(convId: string, msgId: string, callId: string) {
  const conv = conversations().find((c) => c.id === convId);
  const msg = conv?.messages.find((m) => m.id === msgId);
  const tc = msg?.toolCalls?.find((c) => c.id === callId);
  if (!tc?.confirmation) return;
  let outcome: string;
  try {
    outcome = executeConfirmedAction(tc.confirmation);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    outcome = `Failed to apply confirmed action: ${m}`;
  }
  const resolvedAll = patchToolCall(convId, msgId, callId, {
    result: outcome,
    confirmation: undefined,
  });
  if (resolvedAll) {
    void resumeAfterToolCalls(convId, msgId);
  }
}

/**
 * User clicked Cancel on a dangerous LLM tool call. Record the
 * cancellation as the result and (if last pending) resume the loop so
 * the LLM can react.
 */
export function cancelPendingToolCall(convId: string, msgId: string, callId: string) {
  const conv = conversations().find((c) => c.id === convId);
  const msg = conv?.messages.find((m) => m.id === msgId);
  const tc = msg?.toolCalls?.find((c) => c.id === callId);
  if (!tc?.confirmation) return;
  const resolvedAll = patchToolCall(convId, msgId, callId, {
    result: "Cancelled by user — no changes made.",
    confirmation: undefined,
    cancelled: true,
  });
  if (resolvedAll) {
    void resumeAfterToolCalls(convId, msgId);
  }
}
