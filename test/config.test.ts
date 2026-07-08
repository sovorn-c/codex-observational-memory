import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { loadConfig, recursionGuarded } from "../src/config.js";

function tempHome(): string {
  return join(tmpdir(), `om-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

describe("config", () => {
  it("loads defaults", () => {
    const config = loadConfig({ CODEX_HOME: tempHome() });
    expect(config.llm.provider).toBe("codex");
    expect(config.llm.model).toBe("gpt-5.4-mini");
    expect(config.memory.observeAfterTokens).toBe(10000);
  });

  it("uses env over config file", () => {
    const home = tempHome();
    mkdirSync(join(home, "observational-memory"), { recursive: true });
    writeFileSync(join(home, "observational-memory", "config.json"), JSON.stringify({
      llm: { provider: "openrouter", model: "file-model", apiKey: "file-key" },
      memory: { observeAfterTokens: 1 }
    }));
    const config = loadConfig({
      CODEX_HOME: home,
      OM_LLM_PROVIDER: "gemini",
      OM_LLM_MODEL: "env-model",
      OM_OBSERVE_AFTER_TOKENS: "123"
    });
    expect(config.llm.provider).toBe("gemini");
    expect(config.llm.model).toBe("env-model");
    expect(config.memory.observeAfterTokens).toBe(123);
  });

  it("normalizes deepseek alias", () => {
    const config = loadConfig({ CODEX_HOME: tempHome(), OM_LLM_PROVIDER: "deepseek" });
    expect(config.llm.provider).toBe("openrouter");
    expect(config.llm.model).toBe("deepseek/deepseek-v4-flash");
    expect(config.warnings.length).toBeGreaterThan(0);
  });

  it("detects recursion guard", () => {
    expect(recursionGuarded({ CODEX_OBSERVATIONAL_MEMORY_WORKER: "1" })).toBe(true);
    expect(recursionGuarded({})).toBe(false);
  });
});
