export const LEDGER_RECORD_TYPES = [
    "om.source.recorded",
    "om.observations.recorded",
    "om.reflections.recorded",
    "om.observations.dropped",
    "om.compaction",
    "om.injected",
    "om.worker.error"
];
export function isMemoryId(id) {
    return typeof id === "string" && /^[a-f0-9]{12}$/.test(id);
}
