export const LEDGER_RECORD_TYPES = [
  "om.source.recorded",
  "om.observations.recorded",
  "om.reflections.recorded",
  "om.observations.dropped",
  "om.compaction",
  "om.injected",
  "om.worker.error"
] as const;

export type LedgerRecordType = (typeof LEDGER_RECORD_TYPES)[number];
export type Relevance = "low" | "medium" | "high" | "critical";

export type Observation = {
  id: string;
  content: string;
  timestamp: string;
  relevance: Relevance;
  sourceEntryIds: string[];
  tokenCount: number;
};

export type Reflection = {
  id: string;
  content: string;
  supportingObservationIds: string[];
  tokenCount: number;
};

export type SourceEntry = {
  id: string;
  threadId: string;
  turnId?: string;
  sessionId?: string;
  timestamp: string;
  role: "user" | "assistant" | "tool" | "system" | "hook" | "unknown";
  kind: string;
  content: string;
  tokenCount: number;
};

export type LedgerRecord =
  | { type: "om.source.recorded"; timestamp: string; sourceEntryIds: string[]; coversUpToId?: string }
  | { type: "om.observations.recorded"; timestamp: string; observations: Observation[]; coversUpToId: string }
  | { type: "om.reflections.recorded"; timestamp: string; reflections: Reflection[]; coversUpToId: string }
  | { type: "om.observations.dropped"; timestamp: string; observationIds: string[]; coversUpToId: string }
  | { type: "om.compaction"; timestamp: string; native?: boolean }
  | { type: "om.injected"; timestamp: string; reason: string }
  | { type: "om.worker.error"; timestamp: string; worker: string; message: string };

export type FoldedLedger = {
  observations: Observation[];
  activeObservations: Observation[];
  droppedObservationIds: Set<string>;
  reflections: Reflection[];
  observationsById: Map<string, Observation>;
  reflectionsById: Map<string, Reflection>;
};

export function isMemoryId(id: unknown): id is string {
  return typeof id === "string" && /^[a-f0-9]{12}$/.test(id);
}
