import { hashId, estimateStringTokens, localTimestamp } from "../tokens.js";
import type { LlmProvider } from "../providers/index.js";
import { observationLine, reflectionLine } from "../ledger/render.js";
import type { Observation, Reflection, Relevance, SourceEntry } from "../ledger/types.js";
import { OBSERVATION_SCHEMA, OBSERVER_SYSTEM } from "./prompts.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeRelevance(value: unknown): Relevance {
  return value === "low" || value === "medium" || value === "high" || value === "critical" ? value : "medium";
}

function normalizeSourceIds(value: unknown, allowed: readonly string[]): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const allowedSet = new Set(allowed);
  const result = Array.from(new Set(value.filter((id): id is string => typeof id === "string" && allowedSet.has(id))));
  return result.length > 0 ? result : undefined;
}

export function buildObserverPrompt(args: {
  reflections: readonly Reflection[];
  observations: readonly Observation[];
  sources: readonly SourceEntry[];
}): string {
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

export async function runObserver(provider: LlmProvider, args: {
  reflections: readonly Reflection[];
  observations: readonly Observation[];
  sources: readonly SourceEntry[];
}): Promise<Observation[]> {
  if (args.sources.length === 0) return [];
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
  const seen = new Set<string>();
  const observations: Observation[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.content !== "string" || !item.content.trim()) continue;
    const sourceEntryIds = normalizeSourceIds(item.sourceEntryIds, allowedSourceIds);
    if (!sourceEntryIds) continue;
    const content = item.content.trim().replace(/\s+/g, " ");
    const id = hashId(content);
    if (seen.has(id)) continue;
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
