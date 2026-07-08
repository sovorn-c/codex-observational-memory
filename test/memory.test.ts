import { describe, expect, it } from "vitest";
import { foldMemoryFiles, rawTokensSinceSourceId } from "../src/memory/fold.js";
import { recall } from "../src/memory/recall.js";
import { renderMemory } from "../src/memory/render.js";
import type { DropRecord, Observation, Reflection, SourceEntry } from "../src/memory/types.js";

const source: SourceEntry = {
  id: "src1",
  threadId: "t",
  timestamp: "2026-07-08 12:00",
  role: "user",
  kind: "prompt",
  content: "Use GraphQL.",
  tokenCount: 10
};

const observations: Observation[] = [{
  id: "aaaaaaaaaaaa",
  content: "User chose GraphQL for the API.",
  timestamp: "2026-07-08 12:00",
  relevance: "high",
  sourceEntryIds: ["src1"],
  tokenCount: 8
}];

const reflections: Reflection[] = [{
  id: "bbbbbbbbbbbb",
  content: "The API direction is GraphQL.",
  supportingObservationIds: ["aaaaaaaaaaaa"],
  tokenCount: 7
}];

const dropped: DropRecord[] = [{
  observationId: "aaaaaaaaaaaa",
  timestamp: "2026-07-08 12:03",
  coversUpToId: "src1"
}];

const memory = { observations, reflections, dropped };

describe("memory files", () => {
  it("folds split memory files and drop tombstones", () => {
    const folded = foldMemoryFiles(memory);
    expect(folded.observations).toHaveLength(1);
    expect(folded.activeObservations).toHaveLength(0);
    expect(folded.reflections).toHaveLength(1);
  });

  it("recalls dropped observation sources", () => {
    const result = recall("bbbbbbbbbbbb", foldMemoryFiles(memory), [source]);
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.observations[0].status).toBe("dropped");
      expect(result.sources[0].content).toBe("Use GraphQL.");
    }
  });

  it("renders memory", () => {
    const folded = foldMemoryFiles(memory);
    const text = renderMemory(folded.reflections, folded.observations);
    expect(text).toContain("## Reflections");
    expect(text).toContain("[bbbbbbbbbbbb]");
  });

  it("calculates token progress after source watermark", () => {
    expect(rawTokensSinceSourceId("src1", [source, { ...source, id: "src2", tokenCount: 5 }])).toBe(5);
  });
});
