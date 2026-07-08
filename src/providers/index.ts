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

export function createProvider(config: OmConfig): LlmProvider {
  const { provider, model, apiKey, baseUrl } = config.llm;
  if (provider === "codex") return new CodexProvider(model);
  if (provider === "openrouter") {
    return new OpenAiCompatibleProvider({
      name: "openrouter",
      model,
      apiKey,
      baseUrl: baseUrl || "https://openrouter.ai/api/v1/chat/completions"
    });
  }
  if (provider === "opencode-go") {
    return new OpenAiCompatibleProvider({
      name: "opencode-go",
      model,
      apiKey,
      baseUrl: baseUrl || "https://opencode.ai/zen/go/v1/chat/completions"
    });
  }
  if (provider === "openai") return new OpenAiProvider({ model, apiKey, baseUrl });
  return new GeminiProvider({ model, apiKey, baseUrl });
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
