import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
export const DEFAULT_CONFIG = {
    llm: {
        provider: "codex",
        model: "gpt-5.4-mini",
        apiKey: ""
    },
    memory: {
        observeAfterTokens: 10_000,
        reflectAfterTokens: 20_000,
        observationsPoolMaxTokens: 20_000,
        observationsPoolTargetTokens: 10_000
    },
    debug: false,
    warnings: []
};
export function codexHome(env = process.env) {
    return env.CODEX_HOME || join(homedir(), ".codex");
}
export function configPath(env = process.env) {
    return join(codexHome(env), "observational-memory", "config.json");
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function readConfigFile(path) {
    if (!existsSync(path))
        return {};
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (!isRecord(parsed))
        return {};
    return parsed;
}
function positiveInt(value) {
    return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}
function positiveIntEnv(value) {
    if (!value)
        return undefined;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
function boolEnv(value) {
    if (value === undefined)
        return undefined;
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized))
        return true;
    if (["0", "false", "no", "off"].includes(normalized))
        return false;
    return undefined;
}
function provider(value) {
    return value === "codex" || value === "openrouter" || value === "opencode-go" || value === "openai" || value === "gemini"
        ? value
        : undefined;
}
function mergeFileConfig(base, file) {
    const next = {
        llm: { ...base.llm },
        memory: { ...base.memory },
        debug: base.debug,
        warnings: [...base.warnings]
    };
    if (isRecord(file.llm)) {
        const p = provider(file.llm.provider);
        if (p)
            next.llm.provider = p;
        if (typeof file.llm.model === "string" && file.llm.model)
            next.llm.model = file.llm.model;
        if (typeof file.llm.apiKey === "string")
            next.llm.apiKey = file.llm.apiKey;
    }
    if (isRecord(file.memory)) {
        next.memory.observeAfterTokens = positiveInt(file.memory.observeAfterTokens) ?? next.memory.observeAfterTokens;
        next.memory.reflectAfterTokens = positiveInt(file.memory.reflectAfterTokens) ?? next.memory.reflectAfterTokens;
        next.memory.observationsPoolMaxTokens = positiveInt(file.memory.observationsPoolMaxTokens) ?? next.memory.observationsPoolMaxTokens;
        next.memory.observationsPoolTargetTokens = positiveInt(file.memory.observationsPoolTargetTokens) ?? next.memory.observationsPoolTargetTokens;
    }
    if (typeof file.debug === "boolean")
        next.debug = file.debug;
    return normalizeConfig(next);
}
function withProviderDefaultModel(config) {
    const next = { ...config, llm: { ...config.llm } };
    if (!next.llm.model) {
        if (next.llm.provider === "codex")
            next.llm.model = "gpt-5.4-mini";
        if (next.llm.provider === "openrouter")
            next.llm.model = "deepseek/deepseek-v4-flash";
        if (next.llm.provider === "opencode-go")
            next.llm.model = "deepseek-v4-flash";
        if (next.llm.provider === "openai")
            next.llm.model = "gpt-5.4-nano";
        if (next.llm.provider === "gemini")
            next.llm.model = "gemini-3.1-flash-lite";
    }
    return next;
}
function normalizeConfig(config) {
    const next = withProviderDefaultModel(config);
    if (next.memory.observationsPoolTargetTokens >= next.memory.observationsPoolMaxTokens) {
        next.memory.observationsPoolTargetTokens = Math.floor(next.memory.observationsPoolMaxTokens / 2);
    }
    return next;
}
export function loadConfig(env = process.env) {
    let config = mergeFileConfig(DEFAULT_CONFIG, readConfigFile(configPath(env)));
    const warnings = [...config.warnings];
    const rawProvider = env.OM_LLM_PROVIDER;
    if (rawProvider) {
        if (rawProvider === "deepseek") {
            config.llm.provider = "openrouter";
            config.llm.model = "deepseek/deepseek-v4-flash";
            warnings.push("OM_LLM_PROVIDER=deepseek is a v1 alias for openrouter; prefer OM_LLM_PROVIDER=openrouter or opencode-go.");
        }
        else {
            const p = provider(rawProvider);
            if (p)
                config.llm.provider = p;
        }
    }
    if (env.OM_LLM_MODEL !== undefined)
        config.llm.model = env.OM_LLM_MODEL;
    if (env.OM_LLM_API_KEY !== undefined)
        config.llm.apiKey = env.OM_LLM_API_KEY;
    config.memory.observeAfterTokens = positiveIntEnv(env.OM_OBSERVE_AFTER_TOKENS) ?? config.memory.observeAfterTokens;
    config.memory.reflectAfterTokens = positiveIntEnv(env.OM_REFLECT_AFTER_TOKENS) ?? config.memory.reflectAfterTokens;
    config.memory.observationsPoolMaxTokens = positiveIntEnv(env.OM_OBSERVATIONS_POOL_MAX_TOKENS) ?? config.memory.observationsPoolMaxTokens;
    config.memory.observationsPoolTargetTokens = positiveIntEnv(env.OM_OBSERVATIONS_POOL_TARGET_TOKENS) ?? config.memory.observationsPoolTargetTokens;
    config.debug = boolEnv(env.OM_DEBUG) ?? config.debug;
    config.warnings = warnings;
    return normalizeConfig(config);
}
export function recursionGuarded(env = process.env) {
    return env.CODEX_OBSERVATIONAL_MEMORY_WORKER === "1";
}
