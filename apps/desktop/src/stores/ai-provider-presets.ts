import type { AIProvider } from "./ai-store";

/**
 * Curated registry of LLM providers + their default config + suggested
 * free models, so the Assistant Settings tab can offer one-click setup
 * instead of asking users to look up base URLs and model IDs.
 *
 * Every entry is independently OpenAI-compatible (or one of the
 * dedicated provider types) and can be plugged in by:
 *   1. picking the preset → base URL + suggested models auto-fill
 *   2. clicking "Get free API key →" if the user doesn't have one
 *   3. pasting the key + selecting a model from the suggested list
 *
 * The "free tier" column in the comments is a snapshot at the time of
 * writing — providers change their plans regularly. Always check the
 * sign-up page for the current limits.
 */

export interface ProviderPreset {
  /** Stable identifier (also used as a React-style key). */
  id: string;
  /** User-facing label shown in the Settings UI. */
  label: string;
  /** Short blurb shown under the label (free-tier description). */
  description: string;
  /** Which provider type in `ai-store.ts` to switch to when this preset is picked. */
  providerType: AIProvider;
  /** Default base URL (omit for `echo` / `ollama`'s already-default URL). */
  baseUrl: string;
  /** First-choice model — auto-filled into the model field. */
  defaultModel: string;
  /** Curated list of free / cheap models the user can pick from. */
  suggestedModels: string[];
  /** Where the user can sign up for a free API key. Empty for offline providers. */
  signupUrl: string;
  /** Does this preset require an API key? (Echo / Ollama don't.) */
  requiresKey: boolean;
  /** Optional emoji icon for the dropdown row. */
  icon: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "echo",
    label: "Echo (offline mock)",
    description: "Built-in echo bot — no network, no key, just bounces messages back. Slash commands still work.",
    providerType: "echo",
    baseUrl: "",
    defaultModel: "",
    suggestedModels: [],
    signupUrl: "",
    requiresKey: false,
    icon: "🪞",
  },
  {
    id: "ollama",
    label: "Ollama (local, offline)",
    description: "Run open-source LLMs locally on your machine. 100% private, no API key, no rate limit. Settings panel auto-detects installed models via /api/tags and flags ones that support tool-calling. Requires installing Ollama (~ollama.com).",
    providerType: "ollama",
    baseUrl: "http://localhost:11434",
    defaultModel: "llama3.1:8b",
    suggestedModels: [
      "llama3.1:8b",
      "llama3.3:70b",
      "qwen2.5:7b",
      "qwen2.5-coder:7b",
      "qwen2.5-coder:14b",
      "qwen3:8b",
      "mistral-nemo:12b",
      "hermes3:8b",
      "command-r:35b",
    ],
    signupUrl: "https://ollama.com/download",
    requiresKey: false,
    icon: "🦙",
  },
  {
    id: "groq",
    label: "Groq",
    description: "Custom inference hardware (LPU). Free tier: 30 req/min, 14.4k tokens/min. Sign-in via Google / GitHub, no card needed. Sub-second responses.",
    providerType: "openai-compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    suggestedModels: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "qwen-qwq-32b",
      "deepseek-r1-distill-llama-70b",
      "mixtral-8x7b-32768",
      "gemma2-9b-it",
    ],
    signupUrl: "https://console.groq.com/keys",
    requiresKey: true,
    icon: "⚡",
  },
  {
    id: "openrouter",
    label: "OpenRouter (free models)",
    description: "Aggregator with many `:free` models from Llama, DeepSeek, Gemma, Qwen, Mistral. Sign-in via Google / GitHub. Free models share a daily quota.",
    providerType: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
    suggestedModels: [
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemma-3-27b-it:free",
      "qwen/qwen3-coder:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "nousresearch/hermes-3-llama-3.1-405b:free",
      "openai/gpt-oss-120b:free",
      "openai/gpt-oss-20b:free",
    ],
    signupUrl: "https://openrouter.ai/keys",
    requiresKey: true,
    icon: "🔀",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    description: "Google AI Studio. Free tier: 15 req/min, 1M tokens/min, 1500 req/day. OpenAI-compat endpoint. Login with Google account.",
    providerType: "openai-compatible",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
    suggestedModels: [
      "gemini-2.0-flash",
      "gemini-2.5-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
    ],
    signupUrl: "https://aistudio.google.com/apikey",
    requiresKey: true,
    icon: "✨",
  },
  {
    id: "cerebras",
    label: "Cerebras",
    description: "Wafer-scale chips → fastest token throughput on the market. Free tier: 30 req/min. Sign-in via Google / GitHub.",
    providerType: "openai-compatible",
    baseUrl: "https://api.cerebras.ai/v1",
    defaultModel: "llama3.3-70b",
    suggestedModels: [
      "llama3.3-70b",
      "llama-4-scout-17b-16e-instruct",
      "qwen-3-32b",
      "deepseek-r1-distill-llama-70b",
    ],
    signupUrl: "https://cloud.cerebras.ai/",
    requiresKey: true,
    icon: "🚀",
  },
  {
    id: "together",
    label: "Together AI",
    description: "OSS-friendly host. $1 free credit on signup + several `…-Free` SKUs that are free forever (rate-limited).",
    providerType: "openai-compatible",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
    suggestedModels: [
      "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
      "meta-llama/Llama-Vision-Free",
      "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
    ],
    signupUrl: "https://api.together.xyz/settings/api-keys",
    requiresKey: true,
    icon: "🤝",
  },
  {
    id: "mistral",
    label: "Mistral La Plateforme",
    description: "Direct from Mistral. Free tier with rate limits. Login via Google / GitHub.",
    providerType: "openai-compatible",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest",
    suggestedModels: [
      "mistral-small-latest",
      "mistral-large-latest",
      "open-mistral-nemo",
      "open-mixtral-8x7b",
      "codestral-latest",
    ],
    signupUrl: "https://console.mistral.ai/api-keys/",
    requiresKey: true,
    icon: "🌬️",
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "Official OpenAI API. Pay-as-you-go (no real free tier any more — $5 minimum). Best models when paid.",
    providerType: "openai",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    suggestedModels: [
      "gpt-4o-mini",
      "gpt-4o",
      "gpt-4.1-mini",
      "gpt-4.1",
      "o3-mini",
      "o4-mini",
    ],
    signupUrl: "https://platform.openai.com/api-keys",
    requiresKey: true,
    icon: "🟢",
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    description: "Anthropic's API for Claude. $5 free credit on signup, then pay-as-you-go.",
    providerType: "anthropic",
    baseUrl: "https://api.anthropic.com",
    defaultModel: "claude-3-5-sonnet-latest",
    suggestedModels: [
      "claude-3-5-sonnet-latest",
      "claude-3-5-haiku-latest",
      "claude-3-7-sonnet-latest",
      "claude-3-haiku-20240307",
    ],
    signupUrl: "https://console.anthropic.com/settings/keys",
    requiresKey: true,
    icon: "🧠",
  },
  {
    id: "openai-compatible-custom",
    label: "Custom (OpenAI-compatible)",
    description: "Any other OpenAI-compatible endpoint — local llama.cpp server, vLLM, LM Studio, LiteLLM proxy, etc. Configure manually.",
    providerType: "openai-compatible",
    baseUrl: "http://localhost:8080/v1",
    defaultModel: "llama3",
    suggestedModels: [],
    signupUrl: "",
    requiresKey: false,
    icon: "🛠️",
  },
];

export function findPresetById(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id);
}
