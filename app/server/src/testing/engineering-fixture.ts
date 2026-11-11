import type { EngineeringSnapshot, ProjectBinding } from "@simon/contracts";

import type { SnapshotCollection } from "../engineering-snapshot.js";

export const fixtureBinding: ProjectBinding = Object.freeze<ProjectBinding>({
  bindingId: "11111111-1111-4111-8111-111111111111",
  epoch: "22222222-2222-4222-8222-222222222222",
  processId: 42,
  processStartTime: "2026-01-01T00:00:00.000Z",
  projectName: "Synthetic Qualification Project",
  projectPathHash: "a".repeat(64),
  observedAt: "2026-01-01T00:00:01.000Z",
});

export const fixtureSnapshot: EngineeringSnapshot = Object.freeze<EngineeringSnapshot>({
  snapshotId: "33333333-3333-4333-8333-333333333333",
  conversationId: "44444444-4444-4444-8444-444444444444",
  binding: fixtureBinding,
  state: "partial",
  freshness: "current",
  staleReason: null,
  createdAt: "2026-01-01T00:00:02.000Z",
  updatedAt: "2026-01-01T00:00:03.000Z",
  completedAt: "2026-01-01T00:00:03.000Z",
  objectCount: 10,
  byteCount: 1_000,
  documentCount: 3,
  limits: { maxObjects: 100, maxBytes: 1_000_000, maxDurationMs: 30_000, maxResultsPerQuery: 20 },
  coverage: [
    { capability: "tia.block.collection", state: "complete", observedCount: 3, note: "Representative source documents observed." },
    { capability: "tia.reference.collection", state: "partial", observedCount: 1, note: "Reference paths are bounded." },
  ],
});

export const fixtureCollection: SnapshotCollection = Object.freeze<SnapshotCollection>({
  documents: [
    { kind: "block", name: "Main", engineeringPath: "Program blocks/Main", parentPath: "Program blocks", language: "SCL", content: "FUNCTION Main\n// restart delay", artifactId: null, attributes: { constantName: "FC_Main" }, sourceOperation: "tia.block.export", coverage: "complete" },
    { kind: "block", name: "Pump", engineeringPath: "Program blocks/Area A/Pump", parentPath: "Program blocks/Area A", language: "FBD", content: "<Document><NetworkSource><FlgNet /></NetworkSource></Document>", artifactId: null, attributes: {}, sourceOperation: "tia.block.export", coverage: "complete" },
    { kind: "block", name: "Pump", engineeringPath: "Program blocks/Area B/Pump", parentPath: "Program blocks/Area B", language: "LAD", content: "<Document><NetworkSource><FlgNet /></NetworkSource></Document>", artifactId: null, attributes: {}, sourceOperation: "tia.block.export", coverage: "partial" },
  ],
  tagTables: [
    { name: "Inputs", engineeringPath: "PLC tags/Inputs", tags: [{ name: "Ready", dataType: "Bool", logicalAddress: "%I0.0", comment: "Input permissive", sourceOperation: "tia.tag.list", coverage: "complete" }], sourceOperation: "tia.tagTable.list", coverage: "complete" },
    { name: "Outputs", engineeringPath: "PLC tags/Outputs", tags: [{ name: "Ready", dataType: "Bool", logicalAddress: "%Q0.0", comment: "Output state", sourceOperation: "tia.tag.list", coverage: "complete" }], sourceOperation: "tia.tagTable.list", coverage: "complete" },
  ],
  references: [
    { symbol: "Ready", sourcePath: "Program blocks/Main", targetPath: "PLC tags/Inputs/Ready", context: "read in cycle", sourceOperation: "tia.analysis.tagUsages", coverage: "partial" },
  ],
  coverage: fixtureSnapshot.coverage,
});

export function staleFixtureSnapshot(reason = "Fixture detached."): EngineeringSnapshot {
  return {
    ...fixtureSnapshot,
    state: "stale",
    freshness: "stale",
    staleReason: reason,
    updatedAt: "2026-01-01T00:00:04.000Z",
  };
}
