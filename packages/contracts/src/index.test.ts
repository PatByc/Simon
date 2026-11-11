import { describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  conversationSchema,
  createConversationRequestSchema,
  engineeringDocumentSchema,
  engineeringSearchResponseSchema,
  engineeringSnapshotSchema,
  proposalSchema,
  streamEventSchema,
  updateConversationRequestSchema,
} from "./index.js";

const conversationId = "8afc901e-777c-4f9f-bfac-1727efb1f66d";
const runId = "c3fef7e4-790d-4afc-9591-e11df4eb362d";
const occurredAt = "2026-11-07T14:30:00.000Z";
const snapshotId = "44f4769d-1393-4aa0-a461-1e8f801cf9ce";
const bindingId = "0db613bb-d4a6-4f52-b8c5-258a2eaee1f7";
const bindingEpoch = "90e0ae75-03ac-46a1-b206-b0c5876d238c";
const digest = "a".repeat(64);

const binding = {
  bindingId,
  epoch: bindingEpoch,
  processId: 123,
  processStartTime: occurredAt,
  projectName: "Test project",
  projectPathHash: digest,
  observedAt: occurredAt,
};

const provenance = {
  snapshotId,
  bindingId,
  bindingEpoch,
  observedAt: occurredAt,
  sourceOperation: "tia.block.export",
  coverage: "complete" as const,
};

describe("conversationSchema", () => {
  it("accepts a valid conversation", () => {
    const result = conversationSchema.parse({
      conversationId,
      piSessionId: null,
      title: "New conversation",
      createdAt: occurredAt,
      updatedAt: occurredAt,
      selectedModel: null,
      thinkingLevel: null,
      approvalMode: "manual",
      status: "idle",
    });

    expect(result.conversationId).toBe(conversationId);
  });

  it("rejects an invalid lifecycle state", () => {
    expect(() =>
      conversationSchema.parse({
        conversationId,
        piSessionId: null,
        title: "New conversation",
        createdAt: occurredAt,
        updatedAt: occurredAt,
        selectedModel: null,
        thinkingLevel: null,
        approvalMode: "manual",
        status: "complete",
      }),
    ).toThrow();
  });
});

describe("engineering M2 schemas", () => {
  const snapshot = {
    snapshotId,
    conversationId,
    binding,
    state: "completed" as const,
    freshness: "current" as const,
    staleReason: null,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    completedAt: occurredAt,
    objectCount: 1,
    byteCount: 120,
    documentCount: 1,
    limits: { maxObjects: 1_000, maxBytes: 1_000_000, maxDurationMs: 60_000, maxResultsPerQuery: 20 },
    coverage: [{ capability: "blocks", state: "complete" as const, observedCount: 1, note: "Qualified fixture." }],
  };

  const document = {
    documentId: digest,
    snapshotId,
    kind: "block" as const,
    name: "FB_Test",
    engineeringPath: "PLC_1/Program blocks/FB_Test",
    parentPath: "PLC_1/Program blocks",
    language: "SCL",
    contentDigest: digest,
    contentLength: 120,
    artifactId: null,
    excerpt: "FUNCTION_BLOCK FB_Test",
    attributes: { number: 1 },
    provenance,
  };

  it("accepts a bounded binding-scoped snapshot", () => {
    expect(engineeringSnapshotSchema.parse(snapshot).binding.epoch).toBe(bindingEpoch);
  });

  it("rejects unclassified snapshot fields that could leak local paths", () => {
    expect(() => engineeringSnapshotSchema.parse({ ...snapshot, exportPath: "C:/private/export" })).toThrow();
  });

  it("accepts a source document and grounded retrieval hit", () => {
    expect(engineeringDocumentSchema.parse(document).engineeringPath).toContain("FB_Test");
    const result = engineeringSearchResponseSchema.parse({
      snapshot,
      query: "FB_Test",
      hits: [{
        document,
        matchKind: "exact-name",
        score: 100,
        snippet: "FUNCTION_BLOCK FB_Test",
        citation: {
          citationId: digest,
          snapshotId,
          documentId: digest,
          engineeringPath: document.engineeringPath,
          observedAt: occurredAt,
          freshness: "current",
          coverage: "complete",
        },
      }],
      partial: false,
      coverage: snapshot.coverage,
    });
    expect(result.hits[0]?.citation.snapshotId).toBe(snapshotId);
  });

  it("rejects citations with a mismatched digest shape", () => {
    expect(() => engineeringDocumentSchema.parse({ ...document, documentId: "not-a-digest" })).toThrow();
  });
});

describe("request schemas", () => {
  it("defaults new conversations to manual approval", () => {
    expect(createConversationRequestSchema.parse({ title: "Test" }).approvalMode).toBe("manual");
  });

  it("requires at least one conversation update", () => {
    expect(() => updateConversationRequestSchema.parse({})).toThrow();
  });
});

describe("streamEventSchema", () => {
  it("accepts a text delta", () => {
    const event = streamEventSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      runId,
      conversationId,
      sequence: 2,
      occurredAt,
      eventType: "assistant.text.delta",
      payload: { delta: "Hello" },
    });

    expect(event.eventType).toBe("assistant.text.delta");
  });

  it("accepts grounded synthetic knowledge results", () => {
    const event = streamEventSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      runId,
      conversationId,
      sequence: 3,
      occurredAt,
      eventType: "knowledge.sources",
      payload: {
        result: {
          query: "pump",
          sources: [{
            sourceId: "pump-source",
            title: "Pump example",
            objectPath: "SyntheticPlant/PLC_1/FB_Pump",
            excerpt: "Synthetic pump logic.",
            provenance: "synthetic_fixture",
            synthetic: true,
          }],
          coverage: { complete: false, note: "Synthetic fixtures only." },
        },
      },
    });

    expect(event.eventType).toBe("knowledge.sources");
  });

  it("rejects a non-positive sequence", () => {
    expect(() =>
      streamEventSchema.parse({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        runId,
        conversationId,
        sequence: 0,
        occurredAt,
        eventType: "heartbeat",
        payload: {},
      }),
    ).toThrow();
  });

  it("rejects payloads for the wrong event type", () => {
    expect(() =>
      streamEventSchema.parse({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        runId,
        conversationId,
        sequence: 1,
        occurredAt,
        eventType: "run.failed",
        payload: {},
      }),
    ).toThrow();
  });
});

describe("proposalSchema", () => {
  it("requires a valid immutable content digest", () => {
    expect(() =>
      proposalSchema.parse({
        proposalId: "d07f4af7-95a5-467c-89f5-ded7bc703b62",
        conversationId,
        summary: "Synthetic layout preview",
        actions: [
          {
            actionId: "0d642238-2296-48e8-ae92-69e634d88b84",
            operation: "preview",
            targetType: "demo",
            targetId: null,
            description: "Preview a synthetic change",
            fields: {},
            effectClass: "synthetic",
          },
        ],
        status: "pending",
        createdAt: occurredAt,
        expiresAt: "2026-11-07T15:00:00.000Z",
        contentDigest: "not-a-digest",
        synthetic: true,
      }),
    ).toThrow();
  });
});
