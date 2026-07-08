import { hashId, estimateStringTokens, localTimestamp } from "../tokens.js";
import { observationLine, reflectionLine } from "../ledger/render.js";
import { OBSERVATION_SCHEMA, OBSERVER_SYSTEM } from "./prompts.js";
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function normalizeRelevance(value) {
    return value === "low" || value === "medium" || value === "high" || value === "critical" ? value : "medium";
}
function normalizeSourceIds(value, allowed) {
    if (!Array.isArray(value))
        return undefined;
    const allowedSet = new Set(allowed);
    const result = Array.from(new Set(value.filter((id) => typeof id === "string" && allowedSet.has(id))));
    return result.length > 0 ? result : undefined;
}
export function buildObserverPrompt(args) {
    return `CURRENT REFLECTIONS:
${args.reflections.map(reflectionLine).join("\n") || "(none)"}

CURRENT ACTIVE OBSERVATIONS:
${args.observations.map(observationLine).join("\n") || "(none)"}

NEW SOURCE CHUNK:
${args.sources.map((source) => `[Source entry id: ${source.id}]
[${source.role} ${source.kind} @ ${source.timestamp}]
${source.content}`).join("\n\n")}

Emit JSON only.`;
}
export async function runObserver(provider, args) {
    if (args.sources.length === 0)
        return [];
    const response = await provider.runJson({
        kind: "observer",
        systemPrompt: OBSERVER_SYSTEM,
        userPrompt: buildObserverPrompt(args),
        responseSchemaName: OBSERVATION_SCHEMA,
        maxOutputTokens: 4000
    });
    const root = isRecord(response.parsedJson) ? response.parsedJson : {};
    const raw = Array.isArray(root.observations) ? root.observations : [];
    const allowedSourceIds = args.sources.map((source) => source.id);
    const seen = new Set();
    const observations = [];
    for (const item of raw) {
        if (!isRecord(item) || typeof item.content !== "string" || !item.content.trim())
            continue;
        const sourceEntryIds = normalizeSourceIds(item.sourceEntryIds, allowedSourceIds);
        if (!sourceEntryIds)
            continue;
        const content = item.content.trim().replace(/\s+/g, " ");
        const id = hashId(content);
        if (seen.has(id))
            continue;
        seen.add(id);
        observations.push({
            id,
            content,
            timestamp: typeof item.timestamp === "string" && item.timestamp ? item.timestamp : localTimestamp(),
            relevance: normalizeRelevance(item.relevance),
            sourceEntryIds,
            tokenCount: estimateStringTokens(content)
        });
    }
    return observations;
}
