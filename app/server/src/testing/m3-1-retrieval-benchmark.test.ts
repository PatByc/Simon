import { describe, expect, it } from "vitest";

import { createSyntheticBenchmarkRetrieval, retrievalBenchmarkCases, runRetrievalBenchmark } from "./m3-1-retrieval-benchmark.js";

describe("M3.1 retrieval benchmark", () => {
  it("contains the approved 38-case exact, lexical, applicability, ambiguity, and fail-closed matrix", () => {
    expect(retrievalBenchmarkCases).toHaveLength(38);
    expect(retrievalBenchmarkCases.filter((entry) => entry.corpus === "synthetic")).toHaveLength(20);
    expect(retrievalBenchmarkCases.filter((entry) => entry.corpus === "installed")).toHaveLength(18);
    expect(new Set(retrievalBenchmarkCases.map((entry) => entry.id)).size).toBe(38);
    expect(retrievalBenchmarkCases).toEqual(expect.arrayContaining([
      expect.objectContaining({ expected: expect.objectContaining({ outcome: "ambiguity" }) }),
      expect.objectContaining({ expected: expect.objectContaining({ outcome: "none" }) }),
      expect.objectContaining({ expected: expect.objectContaining({ matchKind: "lexical" }) }),
      expect.objectContaining({ expected: expect.objectContaining({ applicability: "adjacent" }) }),
    ]));
  });

  it("passes every synthetic benchmark case deterministically", () => {
    const cases = retrievalBenchmarkCases.filter((entry) => entry.corpus === "synthetic");
    const first = runRetrievalBenchmark(createSyntheticBenchmarkRetrieval(), cases);
    const second = runRetrievalBenchmark(createSyntheticBenchmarkRetrieval(), cases);
    expect(first).toEqual(second);
    expect(first.filter((result) => !result.passed)).toEqual([]);
  });
});
