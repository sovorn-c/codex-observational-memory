import { describe, expect, it, vi, afterEach } from "vitest";
import { createProvider, parseJsonText } from "../src/providers/index.js";
import { OpenAiCompatibleProvider } from "../src/providers/openai-compatible.js";
import { GeminiProvider } from "../src/providers/gemini.js";
import type { OmConfig } from "../src/config.js";

const baseConfig: OmConfig = {
  llm: { provider: "opencode-go", model: "deepseek-v4-flash", apiKey: "k" },
  memory: { observeAfterTokens: 1, reflectAfterTokens: 1, observationsPoolMaxTokens: 10, observationsPoolTargetTokens: 5 },
  debug: false,
  warnings: []
};

describe("providers", () => {
  afterEach(() => vi.restoreAllMocks());

  it("selects opencode-go with correct default model", () => {
    const provider = createProvider(baseConfig);
    expect(provider.name).toBe("opencode-go");
    expect(provider.model).toBe("deepseek-v4-flash");
  });

  it("builds OpenAI-compatible JSON request body", () => {
    const provider = new OpenAiCompatibleProvider({ name: "openrouter", model: "m", apiKey: "k", baseUrl: "u" });
    expect(provider.requestBody({
      kind: "observer",
      systemPrompt: "s",
      userPrompt: "u",
      responseSchemaName: "schema",
      maxOutputTokens: 1
    })).toMatchObject({
      model: "m",
      temperature: 0,
      response_format: { type: "json_object" }
    });
  });

  it("parses fenced JSON", () => {
    expect(parseJsonText("```json\n{\"ok\":true}\n```")).toEqual({ ok: true });
  });

  it("fails loudly when Gemini returns invalid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: "not json" }] } }] })
    })));
    const provider = new GeminiProvider({ model: "gemini-3.1-flash-lite", apiKey: "k" });
    await expect(provider.runJson({
      kind: "observer",
      systemPrompt: "s",
      userPrompt: "u",
      responseSchemaName: "schema",
      maxOutputTokens: 1
    })).rejects.toThrow(/valid JSON/);
  });
});
