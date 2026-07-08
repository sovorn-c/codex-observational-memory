export function foldLedger(records) {
    const observationsById = new Map();
    const reflectionsById = new Map();
    const droppedObservationIds = new Set();
    for (const record of records) {
        if (record.type === "om.observations.recorded") {
            for (const observation of record.observations) {
                if (!observationsById.has(observation.id))
                    observationsById.set(observation.id, observation);
            }
        }
        if (record.type === "om.reflections.recorded") {
            for (const reflection of record.reflections) {
                if (!reflectionsById.has(reflection.id))
                    reflectionsById.set(reflection.id, reflection);
            }
        }
        if (record.type === "om.observations.dropped") {
            for (const id of record.observationIds)
                droppedObservationIds.add(id);
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
function sourceCoverageIndex(sourceIds, id) {
    if (!id)
        return -1;
    return sourceIds.indexOf(id);
}
function latestCoverageIndex(records, sourceIds, type) {
    let latest = -1;
    for (const record of records) {
        if (record.type !== type)
            continue;
        latest = Math.max(latest, sourceCoverageIndex(sourceIds, record.coversUpToId));
    }
    return latest;
}
export function tokenSum(items) {
    return items.reduce((sum, item) => sum + item.tokenCount, 0);
}
export function rawTokensSinceObservationCoverage(records, sources) {
    const index = latestCoverageIndex(records, sources.map((source) => source.id), "om.observations.recorded");
    return tokenSum(sources.slice(index + 1));
}
export function rawTokensSinceReflectionCoverage(records, sources) {
    const index = latestCoverageIndex(records, sources.map((source) => source.id), "om.reflections.recorded");
    return tokenSum(sources.slice(index + 1));
}
