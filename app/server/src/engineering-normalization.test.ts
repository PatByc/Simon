import { describe, expect, it } from "vitest";

import type { EngineeringSnapshot } from "@simon/contracts";

import { normalizeEngineeringRecords } from "./engineering-normalization.js";
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
  objectCount: 6,
  byteCount: 100,
  documentCount: 2,
  limits: { maxObjects: 100, maxBytes: 1_000, maxDurationMs: 10_000, maxResultsPerQuery: 20 },
  coverage: [],
};

function collection(created: string, reverse = false): SnapshotCollection {
  const documents = [
    {
      kind: "block" as const,
      name: " Main ",
      engineeringPath: "Program blocks/Main",
      parentPath: "Program blocks",
      language: " SCL ",
      content: `<?xml version="1.0"?>\r\n<Document>\r\n<DocumentInfo><Created>${created}</Created></DocumentInfo>\r\n<Code>VALUE</Code>\r\n</Document>\r\n`,
      artifactId: null,
      attributes: { typeName: "FC", exportPath: "C:/private/export", nested: { projectPath: "C:/private/project", safe: true } },
      sourceOperation: "tia.block.export",
      coverage: "complete" as const,
    },
    {
      kind: "type" as const,
      name: "Valve",
      engineeringPath: "PLC data types/Valve",
      parentPath: "PLC data types",
      language: null,
      content: "TYPE Valve",
      artifactId: null,
      attributes: {},
      sourceOperation: "tia.type.export",
      coverage: "partial" as const,
    },
  ];
  if (reverse) documents.reverse();
  return {
    documents,
    tagTables: [{
      name: " Default ",
      engineeringPath: "PLC tags/Default",
      tags: [
        { name: "Zed", dataType: " Bool ", logicalAddress: " %I0.1 ", comment: " ", sourceOperation: "tia.tag.list", coverage: "complete" },
        { name: "Alpha", dataType: null, logicalAddress: null, comment: "Ready", sourceOperation: "tia.tag.list", coverage: "complete" },
      ],
      sourceOperation: "tia.tagTable.list",
      coverage: "complete",
    }],
    references: [
      { symbol: "Zed", sourcePath: "Program blocks/Main", targetPath: null, context: " read ", sourceOperation: "tia.analysis.tagUsages", coverage: "partial" },
      { symbol: "Alpha", sourcePath: "Program blocks/Main", targetPath: "PLC tags/Default/Alpha", context: "write", sourceOperation: "tia.analysis.tagUsages", coverage: "complete" },
    ],
    coverage: [],
  };
}

describe("normalizeEngineeringRecords", () => {
  it("produces deterministic IDs, digests, ordering, and provenance", () => {
    const first = normalizeEngineeringRecords(snapshot, collection("2026-01-01T00:00:00Z"));
    const second = normalizeEngineeringRecords(snapshot, collection("2027-02-02T00:00:00Z", true));

    expect(second).toEqual(first);
    expect(first.documents.map((document) => document.engineeringPath)).toEqual([
      "PLC data types/Valve",
      "Program blocks/Main",
    ]);
    expect(first.tagTables[0]?.tags.map((tag) => tag.name)).toEqual(["Alpha", "Zed"]);
    expect(first.references.map((reference) => reference.symbol)).toEqual(["Alpha", "Zed"]);
    expect(first.documents.every((document) => /^[a-f0-9]{64}$/.test(document.documentId))).toBe(true);
    expect(first.documents[1]?.provenance).toEqual({
      snapshotId: snapshot.snapshotId,
      bindingId: snapshot.binding.bindingId,
      bindingEpoch: snapshot.binding.epoch,
      observedAt: snapshot.completedAt,
      sourceOperation: "tia.block.export",
      coverage: "complete",
    });
  });

  it("normalizes optional fields and removes raw local path attributes recursively", () => {
    const records = normalizeEngineeringRecords(snapshot, collection("2026-01-01T00:00:00Z"));
    const block = records.documents.find((document) => document.kind === "block");
    const zed = records.tagTables[0]?.tags.find((tag) => tag.name === "Zed");

    expect(block).toMatchObject({ name: "Main", language: "SCL" });
    expect(block?.excerpt).toContain("<DocumentInfo />");
    expect(JSON.stringify(block?.attributes)).not.toMatch(/exportPath|projectPath|C:\/private/i);
    expect(zed).toMatchObject({ dataType: "Bool", logicalAddress: "%I0.1", comment: null });
  });
});
