const HEADER = `These are source-backed observational memories for this Codex thread.

- Reflections are durable facts distilled from prior observations.
- Observations are timestamped records from earlier thread history.
- Use om_recall(id) when exact source evidence matters.
- If Codex compacted summary conflicts with OM, prefer the newest source-backed observation unless the user says otherwise.`;
export function observationLine(observation) {
    return `[${observation.id}] ${observation.timestamp} [${observation.relevance}] ${observation.content}`;
}
export function reflectionLine(reflection) {
    return `[${reflection.id}] ${reflection.content}`;
}
export function renderMemory(reflections, observations) {
    if (reflections.length === 0 && observations.length === 0)
        return "";
    const parts = [HEADER];
    if (reflections.length > 0)
        parts.push(`## Reflections\n${reflections.map(reflectionLine).join("\n")}`);
    if (observations.length > 0)
        parts.push(`## Observations\n${observations.map(observationLine).join("\n")}`);
    return parts.join("\n\n");
}
