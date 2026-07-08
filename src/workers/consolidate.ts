import { loadConfig } from "../config.js";
import { createProvider } from "../providers/index.js";
import { appendLedger, readLedger, readSources, readState, threadStore, writeState } from "../storage.js";
import { foldLedger, rawTokensSinceObservationCoverage, rawTokensSinceReflectionCoverage, tokenSum } from "../ledger/fold.js";
import { localTimestamp } from "../tokens.js";
import { runDropper } from "./run-dropper.js";
import { runObserver } from "./run-observer.js";
import { runReflector } from "./run-reflector.js";

export type ConsolidationMode = "observe" | "reflect" | "drop" | "all";

function sourcesAfterObservationCoverage(ledger: ReturnType<typeof readLedger>, sources: ReturnType<typeof readSources>) {
  const ids = sources.map((source) => source.id);
  let latest = -1;
  for (const record of ledger) {
    if (record.type === "om.observations.recorded") latest = Math.max(latest, ids.indexOf(record.coversUpToId));
  }
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
    const ledger = readLedger(store);
    const sources = readSources(store);
    let folded = foldLedger(ledger);

    if ((mode === "all" || mode === "observe") && rawTokensSinceObservationCoverage(ledger, sources) >= config.memory.observeAfterTokens) {
      const chunk = sourcesAfterObservationCoverage(ledger, sources);
      const observations = await runObserver(provider, {
        reflections: folded.reflections,
        observations: folded.activeObservations,
        sources: chunk
      });
      if (observations.length > 0 && chunk.at(-1)) {
        appendLedger(store, { type: "om.observations.recorded", timestamp: localTimestamp(), observations, coversUpToId: chunk.at(-1)!.id });
        notes.push(`recorded ${observations.length} observations`);
      }
    }

    const ledgerAfterObserve = readLedger(store);
    folded = foldLedger(ledgerAfterObserve);
    let reflected = false;
    if ((mode === "all" || mode === "reflect") && rawTokensSinceReflectionCoverage(ledgerAfterObserve, sources) >= config.memory.reflectAfterTokens) {
      const reflections = await runReflector(provider, folded.reflections, folded.activeObservations);
      if (reflections.length > 0 && sources.at(-1)) {
        appendLedger(store, { type: "om.reflections.recorded", timestamp: localTimestamp(), reflections, coversUpToId: sources.at(-1)!.id });
        notes.push(`recorded ${reflections.length} reflections`);
        reflected = true;
      }
    }

    const ledgerAfterReflect = readLedger(store);
    folded = foldLedger(ledgerAfterReflect);
    if ((mode === "all" || mode === "drop") && (reflected || mode === "drop") && tokenSum(folded.activeObservations) > config.memory.observationsPoolTargetTokens) {
      const dropIds = await runDropper(provider, {
        reflections: folded.reflections,
        observations: folded.activeObservations,
        targetTokens: config.memory.observationsPoolTargetTokens
      });
      if (dropIds.length > 0 && sources.at(-1)) {
        appendLedger(store, { type: "om.observations.dropped", timestamp: localTimestamp(), observationIds: dropIds, coversUpToId: sources.at(-1)!.id });
        notes.push(`dropped ${dropIds.length} observations`);
      }
    }

    writeState(store, { ...readState(store), workerInFlight: false, lastConsolidatedAt: localTimestamp() });
    return notes.length ? notes : ["nothing to do"];
  } catch (error) {
    appendLedger(store, {
      type: "om.worker.error",
      timestamp: localTimestamp(),
      worker: mode,
      message: error instanceof Error ? error.message : String(error)
    });
    writeState(store, { ...readState(store), workerInFlight: false });
    throw error;
  }
}
