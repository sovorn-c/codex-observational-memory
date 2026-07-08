import { loadConfig } from "../config.js";
import { createProvider } from "../providers/index.js";
import { appendDebug, appendDropped, appendObservations, appendReflections, readMemoryFiles, readSources, readState, threadStore, writeState } from "../storage.js";
import { foldMemoryFiles, rawTokensSinceSourceId, tokenSum } from "../memory/fold.js";
import { localTimestamp } from "../tokens.js";
import { runDropper } from "./run-dropper.js";
import { runObserver } from "./run-observer.js";
import { runReflector } from "./run-reflector.js";

export type ConsolidationMode = "observe" | "reflect" | "drop" | "all";

function sourcesAfterSourceId(sourceId: string | undefined, sources: ReturnType<typeof readSources>) {
  const ids = sources.map((source) => source.id);
  const latest = sourceId ? ids.indexOf(sourceId) : -1;
  return sources.slice(latest + 1);
}

export async function consolidateThread(threadId: string, mode: ConsolidationMode = "all", env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  const config = loadConfig(env);
  for (const warning of config.warnings) process.stderr.write(`${warning}\n`);
  const store = threadStore(threadId, env);
  const state = readState(store);
  if (state.workerInFlight) return ["worker already in flight"];
  writeState(store, { ...state, workerInFlight: true });
  const notes: string[] = [];
  try {
    const provider = createProvider(config);
    const sources = readSources(store);
    let currentState = readState(store);
    let folded = foldMemoryFiles(readMemoryFiles(store));

    if ((mode === "all" || mode === "observe") && rawTokensSinceSourceId(currentState.observedSourceUpToId, sources) >= config.memory.observeAfterTokens) {
      const chunk = sourcesAfterSourceId(currentState.observedSourceUpToId, sources);
      const observations = await runObserver(provider, {
        reflections: folded.reflections,
        observations: folded.activeObservations,
        sources: chunk
      });
      const observedUpToId = chunk.at(-1)?.id;
      if (observedUpToId) writeState(store, { ...readState(store), observedSourceUpToId: observedUpToId });
      if (observations.length > 0) {
        appendObservations(store, observations);
        notes.push(`recorded ${observations.length} observations`);
      }
    }

    currentState = readState(store);
    folded = foldMemoryFiles(readMemoryFiles(store));
    let reflected = false;
    if ((mode === "all" || mode === "reflect") && rawTokensSinceSourceId(currentState.reflectedSourceUpToId, sources) >= config.memory.reflectAfterTokens) {
      const reflections = await runReflector(provider, folded.reflections, folded.activeObservations);
      const reflectedUpToId = sources.at(-1)?.id;
      if (reflectedUpToId) writeState(store, { ...readState(store), reflectedSourceUpToId: reflectedUpToId });
      if (reflections.length > 0) {
        appendReflections(store, reflections);
        notes.push(`recorded ${reflections.length} reflections`);
        reflected = true;
      }
    }

    folded = foldMemoryFiles(readMemoryFiles(store));
    if ((mode === "all" || mode === "drop") && (reflected || mode === "drop") && tokenSum(folded.activeObservations) > config.memory.observationsPoolTargetTokens) {
      const dropIds = await runDropper(provider, {
        reflections: folded.reflections,
        observations: folded.activeObservations,
        targetTokens: config.memory.observationsPoolTargetTokens
      });
      if (dropIds.length > 0 && sources.at(-1)) {
        appendDropped(store, dropIds.map((observationId) => ({ observationId, timestamp: localTimestamp(), coversUpToId: sources.at(-1)!.id })));
        notes.push(`dropped ${dropIds.length} observations`);
      }
    }

    writeState(store, { ...readState(store), workerInFlight: false, lastConsolidatedAt: localTimestamp() });
    return notes.length ? notes : ["nothing to do"];
  } catch (error) {
    appendDebug("worker.error", { threadId, worker: mode, message: error instanceof Error ? error.message : String(error) }, env);
    writeState(store, { ...readState(store), workerInFlight: false });
    throw error;
  }
}
