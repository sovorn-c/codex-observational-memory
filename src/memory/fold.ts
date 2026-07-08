import type { DropRecord, FoldedMemory, Observation, Reflection } from "./types.js";

export function foldMemoryFiles(args: {
  observations: readonly Observation[];
  reflections: readonly Reflection[];
  dropped: readonly DropRecord[];
}): FoldedMemory {
  const observationsById = new Map<string, Observation>();
  const reflectionsById = new Map<string, Reflection>();
  const droppedObservationIds = new Set<string>();

  for (const observation of args.observations) {
    if (!observationsById.has(observation.id)) observationsById.set(observation.id, observation);
  }
  for (const reflection of args.reflections) {
    if (!reflectionsById.has(reflection.id)) reflectionsById.set(reflection.id, reflection);
  }
  for (const drop of args.dropped) droppedObservationIds.add(drop.observationId);

  const observations = Array.from(observationsById.values());
  const reflections = Array.from(reflectionsById.values());
  return {
    observations,
    activeObservations: observations.filter((observation) => !droppedObservationIds.has(observation.id)),
    droppedObservationIds,
    reflections,
    observationsById,
    reflectionsById
  };
}

function sourceCoverageIndex(sourceIds: readonly string[], id: string | undefined): number {
  if (!id) return -1;
  return sourceIds.indexOf(id);
}

export function tokenSum(items: readonly { tokenCount: number }[]): number {
  return items.reduce((sum, item) => sum + item.tokenCount, 0);
}

export function rawTokensSinceSourceId(sourceId: string | undefined, sources: readonly { id: string; tokenCount: number }[]): number {
  const index = sourceCoverageIndex(sources.map((source) => source.id), sourceId);
  return tokenSum(sources.slice(index + 1));
}
