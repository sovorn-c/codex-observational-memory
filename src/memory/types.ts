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

export type DropRecord = {
  observationId: string;
  timestamp: string;
  coversUpToId?: string;
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

export type FoldedMemory = {
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
