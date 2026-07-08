import type { LlmProvider } from "../providers/index.js";
import { observationLine, reflectionLine } from "../memory/render.js";
import type { Observation, Reflection } from "../memory/types.js";
import { DROPPER_SCHEMA, DROPPER_SYSTEM } from "./prompts.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const RELEVANCE_RANK: Record<Observation["relevance"], number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
};

function tokenSum(observations: readonly Observation[]): number {
  return observations.reduce((sum, observation) => sum + observation.tokenCount, 0);
}

export function maxDropCount(observations: readonly Observation[], targetTokens: number): number {
  const total = tokenSum(observations);
  if (observations.length === 0 || total <= targetTokens) return 0;
  return Math.min(observations.length, Math.max(1, Math.ceil((total - targetTokens) / (total / observations.length))));
}

export function selectDropIds(proposed: readonly string[], observations: readonly Observation[], maxDrops: number): string[] {
  const byId = new Map(observations.map((observation) => [observation.id, observation]));
  return Array.from(new Set(proposed))
    .flatMap((id) => {
      const observation = byId.get(id);
      return observation ? [{ id, observation }] : [];
    })
    .sort((a, b) => RELEVANCE_RANK[a.observation.relevance] - RELEVANCE_RANK[b.observation.relevance] || a.observation.timestamp.localeCompare(b.observation.timestamp))
    .slice(0, maxDrops)
    .map((item) => item.id);
}

export async function runDropper(provider: LlmProvider, args: {
  reflections: readonly Reflection[];
  observations: readonly Observation[];
  targetTokens: number;
}): Promise<string[]> {
  const maxDrops = maxDropCount(args.observations, args.targetTokens);
  if (maxDrops <= 0) return [];
  const total = tokenSum(args.observations);
  const response = await provider.runJson({
    kind: "dropper",
    systemPrompt: DROPPER_SYSTEM,
    userPrompt: `CURRENT REFLECTIONS:
${args.reflections.map(reflectionLine).join("\n") || "(none)"}

ACTIVE OBSERVATIONS:
${args.observations.map(observationLine).join("\n") || "(none)"}

Active observation pool: ${total} tokens. Target: ${args.targetTokens} tokens. Maximum drops allowed: ${maxDrops}.

Emit JSON only.`,
    responseSchemaName: DROPPER_SCHEMA,
    maxOutputTokens: 2000
  });
  const root = isRecord(response.parsedJson) ? response.parsedJson : {};
  const raw = Array.isArray(root.dropObservationIds) ? root.dropObservationIds.filter((id): id is string => typeof id === "string") : [];
  return selectDropIds(raw, args.observations, maxDrops);
}
