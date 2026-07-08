import type { FoldedLedger, Reflection, SourceEntry } from "./types.js";

export type RecallResult =
  | { status: "not_found"; id: string }
  | {
      status: "found";
      id: string;
      kind: "observation" | "reflection" | "mixed";
      reflections: Reflection[];
      observations: Array<{ id: string; status: "active" | "dropped"; content: string; sourceEntryIds: string[] }>;
      sources: SourceEntry[];
      missingSourceEntryIds: string[];
      missingSupportingObservationIds: string[];
    };

export function recall(id: string, folded: FoldedLedger, sources: readonly SourceEntry[]): RecallResult {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const directObservation = folded.observationsById.get(id);
  const directReflection = folded.reflectionsById.get(id);
  if (!directObservation && !directReflection) return { status: "not_found", id };

  const reflections = directReflection ? [directReflection] : [];
  const observationIds = new Set<string>();
  if (directObservation) observationIds.add(directObservation.id);
  if (directReflection) {
    for (const observationId of directReflection.supportingObservationIds) observationIds.add(observationId);
  }

  const missingSupportingObservationIds: string[] = [];
  const observations = Array.from(observationIds).flatMap((observationId) => {
    const observation = folded.observationsById.get(observationId);
    if (!observation) {
      missingSupportingObservationIds.push(observationId);
      return [];
    }
    return [{
      id: observation.id,
      status: folded.droppedObservationIds.has(observation.id) ? "dropped" as const : "active" as const,
      content: observation.content,
      sourceEntryIds: observation.sourceEntryIds
    }];
  });

  const missingSourceEntryIds: string[] = [];
  const foundSources: SourceEntry[] = [];
  const seenSources = new Set<string>();
  for (const observation of observations) {
    for (const sourceId of observation.sourceEntryIds) {
      const source = sourceById.get(sourceId);
      if (!source) {
        missingSourceEntryIds.push(sourceId);
        continue;
      }
      if (!seenSources.has(source.id)) {
        seenSources.add(source.id);
        foundSources.push(source);
      }
    }
  }

  return {
    status: "found",
    id,
    kind: directObservation && directReflection ? "mixed" : directReflection ? "reflection" : "observation",
    reflections,
    observations,
    sources: foundSources,
    missingSourceEntryIds: Array.from(new Set(missingSourceEntryIds)),
    missingSupportingObservationIds: Array.from(new Set(missingSupportingObservationIds))
  };
}
