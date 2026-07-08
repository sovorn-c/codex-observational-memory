import type { OmConfig } from "../config.js";
import { CodexProvider } from "./codex.js";
import { GeminiProvider } from "./gemini.js";
import { OpenAiProvider } from "./openai.js";
import { OpenAiCompatibleProvider } from "./openai-compatible.js";

export type WorkerKind = "observer" | "reflector" | "dropper";

export type WorkerRequest = {
  kind: WorkerKind;
  systemPrompt: string;
  userPrompt: string;
  responseSchemaName: string;
  maxOutputTokens: number;
};

export type WorkerResponse = {
  provider: string;
  model: string;
  text: string;
  parsedJson?: unknown;
  inputTokens?: number;
  outputTokens?: number;
};

export interface LlmProvider {
  name: string;
  model: string;
  runJson(request: WorkerRequest): Promise<WorkerResponse>;
}

const PROVIDER_ENDPOINTS = {
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  opencodeGo: "https://opencode.ai/zen/go/v1/chat/completions"
} as const;

export function createProvider(config: OmConfig): LlmProvider {
  const { provider, model, apiKey } = config.llm;
  if (provider === "codex") return new CodexProvider(model);
  if (provider === "openrouter") {
    return new OpenAiCompatibleProvider({
      name: "openrouter",
      model,
      apiKey,
      baseUrl: PROVIDER_ENDPOINTS.openrouter
    });
  }
  if (provider === "opencode-go") {
    return new OpenAiCompatibleProvider({
      name: "opencode-go",
      model,
      apiKey,
      baseUrl: PROVIDER_ENDPOINTS.opencodeGo
    });
  }
  if (provider === "openai") return new OpenAiProvider({ model, apiKey });
  return new GeminiProvider({ model, apiKey });
}

export function parseJsonText(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/) ?? trimmed.match(/(\{[\s\S]*\})/);
    if (!match) throw new Error("Worker response was not valid JSON.");
    return JSON.parse(match[1]);
  }
}
