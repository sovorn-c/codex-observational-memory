export function foldMemoryFiles(args) {
    const observationsById = new Map();
    const reflectionsById = new Map();
    const droppedObservationIds = new Set();
    for (const observation of args.observations) {
        if (!observationsById.has(observation.id))
            observationsById.set(observation.id, observation);
    }
    for (const reflection of args.reflections) {
        if (!reflectionsById.has(reflection.id))
            reflectionsById.set(reflection.id, reflection);
    }
    for (const drop of args.dropped)
        droppedObservationIds.add(drop.observationId);
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
export function tokenSum(items) {
    return items.reduce((sum, item) => sum + item.tokenCount, 0);
}
export function rawTokensSinceSourceId(sourceId, sources) {
    const index = sourceCoverageIndex(sources.map((source) => source.id), sourceId);
    return tokenSum(sources.slice(index + 1));
}
