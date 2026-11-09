import { describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  conversationSchema,
  createConversationRequestSchema,
  proposalSchema,
  streamEventSchema,
  updateConversationRequestSchema,
} from "./index.js";

const conversationId = "8afc901e-777c-4f9f-bfac-1727efb1f66d";
const runId = "c3fef7e4-790d-4afc-9591-e11df4eb362d";
const occurredAt = "2026-11-07T14:30:00.000Z";

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
