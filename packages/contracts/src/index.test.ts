import { describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  conventionDecisionSchema,
  conventionDraftSchema,
  conventionRevisionSchema,
  conventionStatusResponseSchema,
  conversationSchema,
  createConversationRequestSchema,
  documentationApplicabilitySchema,
  documentationSearchRequestSchema,
  documentationSearchResponseSchema,
  documentationSourceSchema,
  documentationStatusResponseSchema,
  documentationTopicSchema,
  engineeringDocumentSchema,
  engineeringSearchResponseSchema,
  engineeringSnapshotSchema,
  knowledgeAuthoritySchema,
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

describe("M3 convention lifecycle contracts", () => {
  const evidence = { evidenceId: digest, authority: "observed-project" as const, sourceId: snapshotId, citation: "PLC_1/Program blocks/FB_Valve", excerpt: "Representative local pattern.", observedAt: occurredAt };
  const draft = { conventionId: digest, state: "proposed" as const, title: "Valve FB naming", rule: "Prefix valve function blocks with FB_Valve.", rationale: "Observed consistently in authorized examples.", scope: ["PLC software"], evidence: [evidence], exceptions: ["Vendor blocks are excluded."], confidence: "high" as const, createdAt: occurredAt, createdBy: "simon-inference" as const };
  const decision = { decisionId: conversationId, action: "approve" as const, decidedAt: occurredAt, decidedBy: "engineer", note: "Approved after review.", hostRecorded: true as const };
  const revision = { revisionId: "b".repeat(64), conventionId: digest, revision: 1, state: "approved" as const, title: draft.title, rule: draft.rule, rationale: draft.rationale, scope: draft.scope, evidence: draft.evidence, exceptions: draft.exceptions, approvedAt: occurredAt, decision, supersedesRevisionId: null };

  it("validates proposed drafts and immutable approved revision payloads", () => {
    expect(conventionDraftSchema.parse(draft).state).toBe("proposed");
    expect(conventionDecisionSchema.parse(decision).hostRecorded).toBe(true);
    expect(conventionRevisionSchema.parse(revision).revision).toBe(1);
    expect(conventionStatusResponseSchema.parse({ proposed: [draft], active: [revision], retired: [], rejectedCount: 0 }).active).toHaveLength(1);
  });

  it("rejects self-approval, missing evidence, mutable states, and unrecorded decisions", () => {
    expect(() => conventionDraftSchema.parse({ ...draft, evidence: [] })).toThrow();
    expect(() => conventionDecisionSchema.parse({ ...decision, hostRecorded: false })).toThrow();
    expect(() => conventionRevisionSchema.parse({ ...revision, state: "proposed" })).toThrow();
    expect(() => conventionRevisionSchema.parse({ ...revision, decision: { ...decision, decidedBy: "" } })).toThrow();
  });
});

describe("M3 documentation contracts", () => {
  const source = {
    sourceId: digest,
    kind: "installed-help" as const,
    authority: "official-documentation" as const,
    title: "STEP 7 installed help",
    product: "STEP 7",
    version: "V20",
    update: "Update 7",
    locale: "en-US",
    canonicalUrl: null,
    rightsStatus: "local-only" as const,
    state: "ready" as const,
    extractionMethod: "installed-zip-html",
    contentDigest: digest,
    indexedAt: occurredAt,
    statusNote: "Local-only source.",
    attributes: {},
  };
  const topic = {
    topicId: "b".repeat(64),
    sourceId: digest,
    stableKey: "ProgSCL/REF",
    title: "REF: Create a reference to a tag",
    aliases: ["REF"],
    product: "STEP 7",
    version: "V20",
    update: "Update 7",
    locale: "en-US",
    contentDigest: "c".repeat(64),
    contentLength: 120,
    excerpt: "Creates a reference.",
    explicitScope: "$DEVICE='S7-1500'",
    attributes: {},
  };
  const applicability = {
    state: "exact" as const,
    evidence: [{ field: "version" as const, targetValue: "V20", sourceValue: "V20", relation: "exact" as const }],
    reasons: ["Version matches V20."],
    explicitScope: "$DEVICE='S7-1500'",
  };

  it("validates strict source, topic, applicability, search, status, and citation payloads", () => {
    expect(documentationSourceSchema.parse(source).state).toBe("ready");
    expect(documentationTopicSchema.parse(topic).title).toContain("REF");
    expect(documentationApplicabilitySchema.parse(applicability).state).toBe("exact");
    expect(documentationSearchRequestSchema.parse({
      query: "REF", target: { product: "STEP 7", version: "V20", update: "Update 7", cpuFamily: "S7-1500", firmware: null, language: "SCL", locale: "en-US" },
    }).allowAdjacent).toBe(false);
    expect(documentationStatusResponseSchema.parse({ sources: [source], topicCount: 1, currentSourceCount: 1, blockedSourceCount: 0, partial: false, statusNote: "Ready." }).topicCount).toBe(1);
    expect(documentationSearchResponseSchema.parse({
      query: "REF",
      target: { product: "STEP 7", version: "V20", update: "Update 7", cpuFamily: "S7-1500", firmware: null, language: "SCL", locale: "en-US" },
      hits: [{ source, topic, matchKind: "exact-alias", score: 1, snippet: "Creates a reference.", applicability, citation: { citationId: "d".repeat(64), sourceId: digest, topicId: topic.topicId, sourceKind: "installed-help", sourceTitle: source.title, topicTitle: topic.title, product: "STEP 7", version: "V20", update: "Update 7", locale: "en-US", applicability, canonicalUrl: null, indexedAt: occurredAt } }],
      partial: false,
      statusNote: "One applicable result.",
    }).hits).toHaveLength(1);
  });

  it("rejects unbounded or unsupported documentation payloads", () => {
    expect(() => documentationSearchRequestSchema.parse({ query: "REF", limit: 101, target: { product: null, version: null, update: null, cpuFamily: null, firmware: null, language: null, locale: null } })).toThrow();
    expect(() => documentationSourceSchema.parse({ ...source, canonicalUrl: "file:///private/help", extra: true })).toThrow();
    expect(documentationApplicabilitySchema.parse({ state: "unknown", evidence: [], reasons: ["No target fields are known."], explicitScope: null }).state).toBe("unknown");
  });
});

describe("M3 knowledge safety contracts", () => {
  it("accepts only explicit evidence authority classes", () => {
    expect(knowledgeAuthoritySchema.parse("official-documentation")).toBe("official-documentation");
    expect(knowledgeAuthoritySchema.parse("approved-convention")).toBe("approved-convention");
    expect(() => knowledgeAuthoritySchema.parse("model-generated")).toThrow();
    expect(() => knowledgeAuthoritySchema.parse("documentation-command")).toThrow();
  });
});

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
