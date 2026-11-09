import { describe, expect, it } from "vitest";
import { KnowledgeService } from "./knowledge-service.js";

describe("KnowledgeService", () => {
  it("ranks matching synthetic sources and discloses incomplete coverage", () => {
    const result = new KnowledgeService().search("pump restart timer");

    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.sources.every((source) => source.synthetic)).toBe(true);
    expect(result.coverage.complete).toBe(false);
    expect(result.coverage.note).toContain("no TIA project");
  });

  it("returns no results rather than inventing a match", () => {
    expect(new KnowledgeService().search("quantum flux capacitor").sources).toEqual([]);
  });
});
