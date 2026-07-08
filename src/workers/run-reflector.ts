import { hashId, estimateStringTokens } from "../tokens.js";
import type { LlmProvider } from "../providers/index.js";
import { observationLine, reflectionLine } from "../memory/render.js";
import type { Observation, Reflection } from "../memory/types.js";
import { REFLECTION_SCHEMA, REFLECTOR_SYSTEM } from "./prompts.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeIds(value: unknown, allowed: readonly string[]): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const allowedSet = new Set(allowed);
  const result = Array.from(new Set(value.filter((id): id is string => typeof id === "string" && allowedSet.has(id))));
  return result.length > 0 ? result : undefined;
}

export function buildReflectorPrompt(reflections: readonly Reflection[], observations: readonly Observation[]): string {
  return `CURRENT REFLECTIONS:
${reflections.map(reflectionLine).join("\n") || "(none)"}

ACTIVE OBSERVATIONS:
${observations.map(observationLine).join("\n") || "(none)"}

Emit JSON only.`;
}

export async function runReflector(provider: LlmProvider, reflections: readonly Reflection[], observations: readonly Observation[]): Promise<Reflection[]> {
  if (observations.length === 0) return [];
  const response = await provider.runJson({
    kind: "reflector",
    systemPrompt: REFLECTOR_SYSTEM,
    userPrompt: buildReflectorPrompt(reflections, observations),
    responseSchemaName: REFLECTION_SCHEMA,
    maxOutputTokens: 3000
  });
  const root = isRecord(response.parsedJson) ? response.parsedJson : {};
  const raw = Array.isArray(root.reflections) ? root.reflections : [];
  const allowedIds = observations.map((observation) => observation.id);
  const existingIds = new Set(reflections.map((reflection) => reflection.id));
  const seen = new Set<string>();
  const output: Reflection[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.content !== "string" || !item.content.trim()) continue;
    const supportingObservationIds = normalizeIds(item.supportingObservationIds, allowedIds);
    if (!supportingObservationIds) continue;
    const content = item.content.trim().replace(/\s+/g, " ");
    if (/\r|\n/.test(content)) continue;
    const id = hashId(content);
    if (existingIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    output.push({ id, content, supportingObservationIds, tokenCount: estimateStringTokens(content) });
  }
  return output;
}
