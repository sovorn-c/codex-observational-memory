import { describe, expect, it } from "vitest";
import { foldLedger, rawTokensSinceObservationCoverage } from "../src/ledger/fold.js";
import { recall } from "../src/ledger/recall.js";
import { renderMemory } from "../src/ledger/render.js";
import type { LedgerRecord, SourceEntry } from "../src/ledger/types.js";

const source: SourceEntry = {
  id: "src1",
  threadId: "t",
  timestamp: "2026-07-08 12:00",
  role: "user",
  kind: "prompt",
  content: "Use GraphQL.",
  tokenCount: 10
};

const records: LedgerRecord[] = [
  {
    type: "om.observations.recorded",
    timestamp: "2026-07-08 12:01",
    coversUpToId: "src1",
    observations: [{
      id: "aaaaaaaaaaaa",
      content: "User chose GraphQL for the API.",
      timestamp: "2026-07-08 12:00",
      relevance: "high",
      sourceEntryIds: ["src1"],
      tokenCount: 8
    }]
  },
  {
    type: "om.reflections.recorded",
    timestamp: "2026-07-08 12:02",
    coversUpToId: "src1",
    reflections: [{
      id: "bbbbbbbbbbbb",
      content: "The API direction is GraphQL.",
      supportingObservationIds: ["aaaaaaaaaaaa"],
      tokenCount: 7
    }]
  },
  {
    type: "om.observations.dropped",
    timestamp: "2026-07-08 12:03",
    coversUpToId: "src1",
    observationIds: ["aaaaaaaaaaaa"]
  }
];

describe("ledger", () => {
  it("folds first-valid records and drop tombstones", () => {
    const folded = foldLedger(records);
    expect(folded.observations).toHaveLength(1);
    expect(folded.activeObservations).toHaveLength(0);
    expect(folded.reflections).toHaveLength(1);
  });

  it("recalls dropped observation sources", () => {
    const result = recall("bbbbbbbbbbbb", foldLedger(records), [source]);
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.observations[0].status).toBe("dropped");
      expect(result.sources[0].content).toBe("Use GraphQL.");
    }
  });

  it("renders memory", () => {
    const text = renderMemory(foldLedger(records).reflections, foldLedger(records).observations);
    expect(text).toContain("## Reflections");
    expect(text).toContain("[bbbbbbbbbbbb]");
  });

  it("calculates token progress after coverage", () => {
    expect(rawTokensSinceObservationCoverage(records, [source, { ...source, id: "src2", tokenCount: 5 }])).toBe(5);
  });
});
