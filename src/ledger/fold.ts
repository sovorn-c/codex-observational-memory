import type { FoldedLedger, LedgerRecord, Observation, Reflection } from "./types.js";

export function foldLedger(records: readonly LedgerRecord[]): FoldedLedger {
  const observationsById = new Map<string, Observation>();
  const reflectionsById = new Map<string, Reflection>();
  const droppedObservationIds = new Set<string>();

  for (const record of records) {
    if (record.type === "om.observations.recorded") {
      for (const observation of record.observations) {
        if (!observationsById.has(observation.id)) observationsById.set(observation.id, observation);
      }
    }
    if (record.type === "om.reflections.recorded") {
      for (const reflection of record.reflections) {
        if (!reflectionsById.has(reflection.id)) reflectionsById.set(reflection.id, reflection);
      }
    }
    if (record.type === "om.observations.dropped") {
      for (const id of record.observationIds) droppedObservationIds.add(id);
    }
  }

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

function latestCoverageIndex(records: readonly LedgerRecord[], sourceIds: readonly string[], type: "om.observations.recorded" | "om.reflections.recorded"): number {
  let latest = -1;
  for (const record of records) {
    if (record.type !== type) continue;
    latest = Math.max(latest, sourceCoverageIndex(sourceIds, record.coversUpToId));
  }
  return latest;
}

export function tokenSum(items: readonly { tokenCount: number }[]): number {
  return items.reduce((sum, item) => sum + item.tokenCount, 0);
}

export function rawTokensSinceObservationCoverage(records: readonly LedgerRecord[], sources: readonly { id: string; tokenCount: number }[]): number {
  const index = latestCoverageIndex(records, sources.map((source) => source.id), "om.observations.recorded");
  return tokenSum(sources.slice(index + 1));
}

export function rawTokensSinceReflectionCoverage(records: readonly LedgerRecord[], sources: readonly { id: string; tokenCount: number }[]): number {
  const index = latestCoverageIndex(records, sources.map((source) => source.id), "om.reflections.recorded");
  return tokenSum(sources.slice(index + 1));
}
