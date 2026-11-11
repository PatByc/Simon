import { describe, expect, it } from "vitest";

import type { EngineeringSnapshot } from "@simon/contracts";

import { normalizeEngineeringRecords } from "./engineering-normalization.js";
import { AmbiguousEngineeringQueryError, EngineeringRetrievalService } from "./engineering-retrieval.js";
import type { SnapshotCollection } from "./engineering-snapshot.js";

const snapshot: EngineeringSnapshot = {
  snapshotId: "11111111-1111-4111-8111-111111111111",
  conversationId: "22222222-2222-4222-8222-222222222222",
  binding: {
    bindingId: "33333333-3333-4333-8333-333333333333",
    epoch: "44444444-4444-4444-8444-444444444444",
    processId: 42,
    processStartTime: "2026-01-01T00:00:00.000Z",
    projectName: "Plant",
    projectPathHash: "a".repeat(64),
    observedAt: "2026-01-01T00:00:01.000Z",
  },
  state: "completed",
  freshness: "current",
  staleReason: null,
  createdAt: "2026-01-01T00:00:02.000Z",
  updatedAt: "2026-01-01T00:00:03.000Z",
  completedAt: "2026-01-01T00:00:03.000Z",
  objectCount: 10,
  byteCount: 100,
  documentCount: 3,
  limits: { maxObjects: 100, maxBytes: 1_000, maxDurationMs: 10_000, maxResultsPerQuery: 2 },
  coverage: [{ capability: "snapshot.documents", state: "complete", observedCount: 3, note: "Observed." }],
};

const collection: SnapshotCollection = {
  documents: [
    { kind: "block", name: "Main", engineeringPath: "Program blocks/Main", parentPath: "Program blocks", language: "SCL", content: "FUNCTION Main", artifactId: null, attributes: { constantName: "OB_Main" }, sourceOperation: "tia.block.export", coverage: "complete" },
    { kind: "block", name: "Pump", engineeringPath: "Program blocks/Area A/Pump", parentPath: "Program blocks/Area A", language: "FBD", content: "Pump A", artifactId: null, attributes: {}, sourceOperation: "tia.block.export", coverage: "complete" },
    { kind: "block", name: "Pump", engineeringPath: "Program blocks/Area B/Pump", parentPath: "Program blocks/Area B", language: "FBD", content: "Pump B", artifactId: null, attributes: {}, sourceOperation: "tia.block.export", coverage: "complete" },
  ],
  tagTables: [
    {
      name: "Inputs",
      engineeringPath: "PLC tags/Inputs",
      tags: [
        { name: "Ready", dataType: "Bool", logicalAddress: "%I0.0", comment: "Input ready", sourceOperation: "tia.tag.list", coverage: "complete" },
      ],
      sourceOperation: "tia.tagTable.list",
      coverage: "complete",
    },
    {
      name: "Outputs",
      engineeringPath: "PLC tags/Outputs",
      tags: [
        { name: "Ready", dataType: "Bool", logicalAddress: "%Q0.0", comment: "Output ready", sourceOperation: "tia.tag.list", coverage: "complete" },
      ],
      sourceOperation: "tia.tagTable.list",
      coverage: "complete",
    },
  ],
  references: [],
  coverage: snapshot.coverage,
};

const records = normalizeEngineeringRecords(snapshot, collection);
const service = new EngineeringRetrievalService();

describe("EngineeringRetrievalService exact search", () => {
  it("resolves exact engineering paths before names and returns stable citations", () => {
    const first = service.searchExact(snapshot, records, { query: "Program blocks/Area A/Pump", limit: 20 });
    const second = service.searchExact(snapshot, records, { query: "Program blocks/Area A/Pump", limit: 20 });

    expect(first.hits).toHaveLength(1);
    expect(first.hits[0]).toMatchObject({
      matchKind: "exact-path",
      score: 100,
      document: { engineeringPath: "Program blocks/Area A/Pump" },
      citation: { freshness: "current", coverage: "complete" },
    });
    expect(second.hits[0]?.citation.citationId).toBe(first.hits[0]?.citation.citationId);
  });

  it("requires path disambiguation for duplicate names", () => {
    expect(() => service.searchExact(snapshot, records, { query: "Pump", limit: 20 }))
      .toThrow(AmbiguousEngineeringQueryError);
    try {
      service.searchExact(snapshot, records, { query: "Pump", limit: 20 });
    } catch (error) {
      expect(error).toMatchObject({
        engineeringPaths: ["Program blocks/Area A/Pump", "Program blocks/Area B/Pump"],
      });
    }
  });

  it("requires path disambiguation for duplicate tag names but resolves logical addresses", () => {
    expect(() => service.searchExact(snapshot, records, { query: "Ready", limit: 20 }))
      .toThrow(/exact engineering path/);
    const result = service.searchExact(snapshot, records, { query: "%Q0.0", limit: 20 });

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]).toMatchObject({
      matchKind: "logical-address",
      document: { kind: "tag", engineeringPath: "PLC tags/Outputs/Ready" },
    });
  });

  it("resolves allowlisted exact identifiers and respects kind filters", () => {
    const identifier = service.searchExact(snapshot, records, { query: "OB_Main", limit: 20 });
    expect(identifier.hits[0]).toMatchObject({ matchKind: "identifier", document: { name: "Main" } });

    const filtered = service.searchExact(snapshot, records, { query: "%Q0.0", limit: 20, kinds: ["block"] });
    expect(filtered.hits).toEqual([]);
  });

  it("ranks exact matches before lexical results", () => {
    let lexicalCalls = 0;
    const result = service.search(snapshot, records, { query: "Main", limit: 20 }, {
      searchEngineeringDocuments: () => { lexicalCalls += 1; return [{ document: records.documents[1]!, score: 0.5, snippet: "lexical" }]; },
    });

    expect(result.hits[0]?.matchKind).toBe("exact-name");
    expect(lexicalCalls).toBe(0);
  });

  it("returns bounded lexical hits with citations when exact lookup is empty", () => {
    const document = records.documents.find((item) => item.name === "Main")!;
    const result = service.search(snapshot, records, { query: "function cycle", limit: 20 }, {
      searchEngineeringDocuments: (snapshotId, query, limit) => {
        expect({ snapshotId, query, limit }).toEqual({ snapshotId: snapshot.snapshotId, query: "function cycle", limit: 2 });
        return [{ document, score: 0.75, snippet: "‹function› cycle" }];
      },
    });

    expect(result.hits[0]).toMatchObject({
      matchKind: "lexical",
      score: 0.75,
      snippet: "‹function› cycle",
      citation: { engineeringPath: "Program blocks/Main", freshness: "current" },
    });
  });

  it("rejects stale snapshots", () => {
    expect(() => service.searchExact({ ...snapshot, state: "stale", freshness: "stale", staleReason: "Detached." }, records, {
      query: "Main",
      limit: 20,
    })).toThrow(/current completed or partial/);
  });
});
