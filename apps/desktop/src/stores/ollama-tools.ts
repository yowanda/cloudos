/**
 * Ollama tool-calling capability detection.
 *
 * Ollama exposes the locally-installed model list at `${baseUrl}/api/tags`.
 * Each entry looks like:
 *
 *     {
 *       name: "llama3.1:8b",
 *       model: "llama3.1:8b",
 *       modified_at: "2024-08-12T...",
 *       size: 4661230966,
 *       digest: "...",
 *       details: {
 *         parent_model: "",
 *         format: "gguf",
 *         family: "llama",
 *         families: ["llama"],
 *         parameter_size: "8.0B",
 *         quantization_level: "Q4_0"
 *       }
 *     }
 *
 * Tool-calling support is a per-model property in the upstream Ollama
 * registry (https://ollama.com/search?c=tools). The `/api/tags` payload
 * does not surface that property, so we maintain a local allow-list of
 * model name prefixes known to be tool-calling-capable. The list is kept
 * conservative — it only includes families that have official tool /
 * function-calling support in their template + chat schema, not models
 * that merely "happen to be coaxed into JSON".
 *
 * Source: scraped from https://ollama.com/search?c=tools (2026-05) plus
 * model card review for each entry.
 */

export type OllamaTagModel = {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[] | null;
    parameter_size: string;
    quantization_level: string;
  };
};

export type OllamaTagsResponse = {
  models: OllamaTagModel[];
};

/**
 * Lower-cased model name prefixes known to support OpenAI-style
 * tool-calling out of the box on Ollama. Match is "starts with" against
 * the raw model name (e.g. "llama3.1:8b" → matches "llama3.1").
 */
export const TOOL_CALLING_MODEL_PREFIXES: readonly string[] = [
  // Meta Llama 3.1 / 3.2 / 3.3 — official tool support
  "llama3.1",
  "llama3.2",
  "llama3.3",
  "llama4",
  // Alibaba Qwen 2.5 / 3 — official tool support
  "qwen2.5",
  "qwen2.5-coder",
  "qwen3",
  "qwen3-coder",
  // Mistral — Nemo, Small, Large all have tools
  "mistral-nemo",
  "mistral-small",
  "mistral-large",
  "mixtral",
  // Cohere Command R / R+
  "command-r",
  "command-r-plus",
  // Nous Hermes 3 (built on llama 3.1)
  "hermes3",
  // IBM Granite 3.x
  "granite3",
  "granite3.1",
  "granite3.2",
  "granite3.3",
  // Microsoft Phi-3.5 (some variants), Phi-4
  "phi4",
  // Google Gemma 3 — has tool support since 3.x
  "gemma3",
  // Smaller specialised tool-calling fine-tunes
  "firefunction-v2",
  "functionary",
  "smollm2",
];

/** Check whether a raw Ollama model name supports tool-calling. */
export function supportsToolCalling(modelName: string): boolean {
  if (!modelName) return false;
  const name = modelName.toLowerCase();
  return TOOL_CALLING_MODEL_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/**
 * Pick the first tool-calling-capable model from a /api/tags response.
 * Returns `null` if the user has nothing tool-capable installed.
 */
export function pickFirstToolCapable(models: OllamaTagModel[]): OllamaTagModel | null {
  for (const m of models) {
    if (supportsToolCalling(m.name)) return m;
  }
  return null;
}

/**
 * Result of an /api/tags probe. The `error` arm captures common
 * failure modes (Ollama not running, CORS rejected, network) so the UI
 * can render an actionable message.
 */
export type OllamaTagsResult =
  | { ok: true; models: OllamaTagModel[] }
  | { ok: false; error: string; hint: string };

/**
 * Fetch installed models from a running Ollama server.
 *
 * Ollama only allows cross-origin requests when the user explicitly sets
 * `OLLAMA_ORIGINS` (or runs with `*`). When the fetch is rejected we
 * surface a hint pointing at that env var, since this is by far the most
 * common reason the call fails in a browser context.
 */
export async function fetchOllamaTags(baseUrl: string): Promise<OllamaTagsResult> {
  if (!baseUrl) {
    return { ok: false, error: "Empty base URL.", hint: "Set the Base URL field." };
  }
  // The Ollama OpenAI-compatible endpoint is at `${root}/v1` while the
  // tag listing lives on the root. Strip a trailing `/v1` if the user
  // pointed the chat config at the OpenAI-compat path.
  const root = baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
  const url = `${root}/api/tags`;
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      return {
        ok: false,
        error: `HTTP ${res.status} from ${url}`,
        hint: "Make sure Ollama is running (`ollama serve`) and the URL is reachable.",
      };
    }
    const data = (await res.json()) as OllamaTagsResponse;
    return { ok: true, models: data.models ?? [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: msg,
      hint:
        "Browser likely blocked the request. Start Ollama with " +
        "`OLLAMA_ORIGINS='*' ollama serve` (or set the var to the CloudOS origin).",
    };
  }
}
