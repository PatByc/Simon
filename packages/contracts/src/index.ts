import { z } from "zod";

export const CONTRACT_SCHEMA_VERSION = 1 as const;

export const idSchema = z.string().uuid();
export const timestampSchema = z.string().datetime({ offset: true });

export const approvalModeSchema = z.enum(["manual", "auto"]);
export type ApprovalMode = z.infer<typeof approvalModeSchema>;

export const knowledgeAuthoritySchema = z.enum([
  "observed-project",
  "official-documentation",
  "inferred-convention",
  "approved-convention",
]);
export type KnowledgeAuthority = z.infer<typeof knowledgeAuthoritySchema>;

export const conversationStatusSchema = z.enum([
  "idle",
  "running",
  "waiting_for_review",
  "failed",
  "interrupted",
]);
export type ConversationStatus = z.infer<typeof conversationStatusSchema>;

export const engineeringModeSchema = z.enum(["synthetic", "tia-readonly"]);
export type EngineeringMode = z.infer<typeof engineeringModeSchema>;

export const engineeringConnectionStateSchema = z.enum([
  "disabled",
  "disconnected",
  "discovering",
  "connecting",
  "connected",
  "stale",
  "failed",
]);
export type EngineeringConnectionState = z.infer<typeof engineeringConnectionStateSchema>;

export const tiaProcessSchema = z.object({
  processId: z.number().int().positive(),
  processStartTime: timestampSchema,
  acquisitionTime: timestampSchema,
  hasProject: z.boolean(),
});
export type TiaProcess = z.infer<typeof tiaProcessSchema>;

export const projectBindingSchema = z.object({
  bindingId: idSchema,
  epoch: idSchema,
  processId: z.number().int().positive(),
  processStartTime: timestampSchema,
  projectName: z.string().min(1),
  projectPathHash: z.string().regex(/^[a-f0-9]{64}$/),
  observedAt: timestampSchema,
});
export type ProjectBinding = z.infer<typeof projectBindingSchema>;

export const engineeringCapabilityStatusSchema = z.enum([
  "live-tested",
  "fake-tested",
  "not-tested",
  "partial",
  "disabled",
  "out-of-scope",
]);
export type EngineeringCapabilityStatus = z.infer<typeof engineeringCapabilityStatusSchema>;

export const engineeringCapabilitySchema = z.object({
  capability: z.string().min(1),
  label: z.string().min(1),
  status: engineeringCapabilityStatusSchema,
  available: z.boolean(),
  note: z.string().min(1),
});
export type EngineeringCapability = z.infer<typeof engineeringCapabilitySchema>;

export const engineeringStatusSchema = z.object({
  mode: engineeringModeSchema,
  state: engineeringConnectionStateSchema,
  binding: projectBindingSchema.nullable(),
  conversationBindingMatches: z.boolean(),
  reason: z.string().optional(),
  observedAt: timestampSchema,
});
export type EngineeringStatus = z.infer<typeof engineeringStatusSchema>;

export const engineeringProcessListSchema = z.object({
  processes: z.array(tiaProcessSchema),
  observedAt: timestampSchema,
});
export type EngineeringProcessList = z.infer<typeof engineeringProcessListSchema>;

export const attachEngineeringRequestSchema = z.object({
  processId: z.number().int().positive(),
  processStartTime: timestampSchema,
});
export type AttachEngineeringRequest = z.infer<typeof attachEngineeringRequestSchema>;

export const engineeringInventorySchema = z.object({
  binding: projectBindingSchema,
  observedAt: timestampSchema,
  projectTree: z.string(),
  partial: z.boolean(),
  coverage: z.array(z.string().min(1)),
});
export type EngineeringInventory = z.infer<typeof engineeringInventorySchema>;

export const engineeringDiagnosticsSchema = z.object({
  mode: engineeringModeSchema,
  piIntegration: z.literal("sdk"),
  piPackageVersion: z.string().min(1),
  mcpPackageVersion: z.string().min(1),
  connector: z.string().min(1),
  tiaMajorVersion: z.number().int().positive().nullable(),
  workerAvailable: z.boolean(),
  modelToolCount: z.number().int().nonnegative(),
  hostToolCount: z.number().int().nonnegative(),
  processCount: z.number().int().nonnegative().nullable(),
  activeBinding: projectBindingSchema.nullable(),
  warnings: z.array(z.string()),
  observedAt: timestampSchema,
});
export type EngineeringDiagnostics = z.infer<typeof engineeringDiagnosticsSchema>;

export const engineeringCapabilitiesSchema = z.object({
  capabilities: z.array(engineeringCapabilitySchema),
  observedAt: timestampSchema,
});
export type EngineeringCapabilities = z.infer<typeof engineeringCapabilitiesSchema>;

export const sha256DigestSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const engineeringCoverageStateSchema = z.enum([
  "complete",
  "partial",
  "unsupported",
  "failed",
  "not-observed",
]);
export type EngineeringCoverageState = z.infer<typeof engineeringCoverageStateSchema>;

export const engineeringObjectKindSchema = z.enum([
  "project",
  "device",
  "device-item",
  "software",
  "block",
  "type",
  "interface",
  "tag-table",
  "tag",
  "reference",
  "source",
]);
export type EngineeringObjectKind = z.infer<typeof engineeringObjectKindSchema>;

export const engineeringSnapshotStateSchema = z.enum([
  "queued",
  "running",
  "completed",
  "partial",
  "interrupted",
  "failed",
  "stale",
]);
export type EngineeringSnapshotState = z.infer<typeof engineeringSnapshotStateSchema>;

export const engineeringSnapshotFreshnessSchema = z.enum(["current", "stale"]);
export type EngineeringSnapshotFreshness = z.infer<typeof engineeringSnapshotFreshnessSchema>;

export const engineeringCoverageSchema = z.object({
  capability: z.string().min(1).max(120),
  state: engineeringCoverageStateSchema,
  observedCount: z.number().int().nonnegative(),
  note: z.string().min(1).max(500),
}).strict();
export type EngineeringCoverage = z.infer<typeof engineeringCoverageSchema>;

export const engineeringProvenanceSchema = z.object({
  snapshotId: idSchema,
  bindingId: idSchema,
  bindingEpoch: idSchema,
  observedAt: timestampSchema,
  sourceOperation: z.string().min(1).max(120),
  coverage: engineeringCoverageStateSchema,
}).strict();
export type EngineeringProvenance = z.infer<typeof engineeringProvenanceSchema>;

export const engineeringSnapshotLimitsSchema = z.object({
  maxObjects: z.number().int().positive().max(100_000),
  maxBytes: z.number().int().positive().max(500_000_000),
  maxDurationMs: z.number().int().positive().max(3_600_000),
  maxResultsPerQuery: z.number().int().positive().max(500),
}).strict();
export type EngineeringSnapshotLimits = z.infer<typeof engineeringSnapshotLimitsSchema>;

export const engineeringSnapshotSchema = z.object({
  snapshotId: idSchema,
  conversationId: idSchema,
  binding: projectBindingSchema,
  state: engineeringSnapshotStateSchema,
  freshness: engineeringSnapshotFreshnessSchema,
  staleReason: z.string().min(1).max(500).nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  completedAt: timestampSchema.nullable(),
  objectCount: z.number().int().nonnegative(),
  byteCount: z.number().int().nonnegative(),
  documentCount: z.number().int().nonnegative(),
  limits: engineeringSnapshotLimitsSchema,
  coverage: z.array(engineeringCoverageSchema).max(100),
}).strict();
export type EngineeringSnapshot = z.infer<typeof engineeringSnapshotSchema>;

export const engineeringDocumentSchema = z.object({
  documentId: sha256DigestSchema,
  snapshotId: idSchema,
  kind: engineeringObjectKindSchema,
  name: z.string().min(1).max(500),
  engineeringPath: z.string().min(1).max(4096),
  parentPath: z.string().min(1).max(4096).nullable(),
  language: z.string().min(1).max(80).nullable(),
  contentDigest: sha256DigestSchema,
  contentLength: z.number().int().nonnegative(),
  artifactId: idSchema.nullable(),
  excerpt: z.string().max(2_000),
  attributes: z.record(z.string(), z.unknown()),
  provenance: engineeringProvenanceSchema,
}).strict();
export type EngineeringDocument = z.infer<typeof engineeringDocumentSchema>;

export const plcTagSchema = z.object({
  tagId: sha256DigestSchema,
  snapshotId: idSchema,
  tablePath: z.string().min(1).max(4096),
  name: z.string().min(1).max(500),
  dataType: z.string().min(1).max(500).nullable(),
  logicalAddress: z.string().min(1).max(500).nullable(),
  comment: z.string().max(4_000).nullable(),
  provenance: engineeringProvenanceSchema,
}).strict();
export type PlcTag = z.infer<typeof plcTagSchema>;

export const plcTagTableSchema = z.object({
  tableId: sha256DigestSchema,
  snapshotId: idSchema,
  name: z.string().min(1).max(500),
  engineeringPath: z.string().min(1).max(4096),
  tagCount: z.number().int().nonnegative(),
  tags: z.array(plcTagSchema).max(100_000),
  provenance: engineeringProvenanceSchema,
}).strict();
export type PlcTagTable = z.infer<typeof plcTagTableSchema>;

export const engineeringReferenceSchema = z.object({
  referenceId: sha256DigestSchema,
  snapshotId: idSchema,
  symbol: z.string().min(1).max(1_000),
  sourcePath: z.string().min(1).max(4096),
  targetPath: z.string().min(1).max(4096).nullable(),
  context: z.string().max(2_000),
  provenance: engineeringProvenanceSchema,
}).strict();
export type EngineeringReference = z.infer<typeof engineeringReferenceSchema>;

export const engineeringCitationSchema = z.object({
  citationId: sha256DigestSchema,
  snapshotId: idSchema,
  documentId: sha256DigestSchema,
  engineeringPath: z.string().min(1).max(4096),
  observedAt: timestampSchema,
  freshness: engineeringSnapshotFreshnessSchema,
  coverage: engineeringCoverageStateSchema,
}).strict();
export type EngineeringCitation = z.infer<typeof engineeringCitationSchema>;

export const engineeringMatchKindSchema = z.enum([
  "exact-path",
  "exact-name",
  "identifier",
  "logical-address",
  "lexical",
]);
export type EngineeringMatchKind = z.infer<typeof engineeringMatchKindSchema>;

export const engineeringRetrievalHitSchema = z.object({
  document: engineeringDocumentSchema,
  matchKind: engineeringMatchKindSchema,
  score: z.number().finite().nonnegative(),
  snippet: z.string().min(1).max(2_000),
  citation: engineeringCitationSchema,
}).strict();
export type EngineeringRetrievalHit = z.infer<typeof engineeringRetrievalHitSchema>;

export const engineeringSearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(500),
  limit: z.number().int().positive().max(100).default(20),
  kinds: z.array(engineeringObjectKindSchema).max(12).optional(),
}).strict();
export type EngineeringSearchRequest = z.infer<typeof engineeringSearchRequestSchema>;

export const engineeringSearchResponseSchema = z.object({
  snapshot: engineeringSnapshotSchema,
  query: z.string().min(1).max(500),
  hits: z.array(engineeringRetrievalHitSchema).max(100),
  partial: z.boolean(),
  coverage: z.array(engineeringCoverageSchema).max(100),
}).strict();
export type EngineeringSearchResponse = z.infer<typeof engineeringSearchResponseSchema>;

export const createEngineeringSnapshotRequestSchema = z.object({
  forceRefresh: z.boolean().default(false),
}).strict();
export type CreateEngineeringSnapshotRequest = z.infer<typeof createEngineeringSnapshotRequestSchema>;

export const engineeringSnapshotStatusResponseSchema = z.object({
  snapshot: engineeringSnapshotSchema.nullable(),
}).strict();
export type EngineeringSnapshotStatusResponse = z.infer<typeof engineeringSnapshotStatusResponseSchema>;

export const documentationSourceKindSchema = z.enum(["installed-help", "official-online"]);
export type DocumentationSourceKind = z.infer<typeof documentationSourceKindSchema>;

export const documentationRightsStatusSchema = z.enum(["local-only", "allowed", "blocked", "unknown"]);
export type DocumentationRightsStatus = z.infer<typeof documentationRightsStatusSchema>;

export const documentationSourceStateSchema = z.enum(["ready", "indexing", "partial", "stale", "blocked", "failed"]);
export type DocumentationSourceState = z.infer<typeof documentationSourceStateSchema>;

export const documentationTargetSchema = z.object({
  product: z.string().min(1).max(120).nullable(),
  version: z.string().min(1).max(40).nullable(),
  update: z.string().min(1).max(40).nullable(),
  cpuFamily: z.string().min(1).max(120).nullable(),
  firmware: z.string().min(1).max(40).nullable(),
  language: z.string().min(1).max(80).nullable(),
  locale: z.string().min(2).max(20).nullable(),
}).strict();
export type DocumentationTarget = z.infer<typeof documentationTargetSchema>;

export const documentationApplicabilityStateSchema = z.enum(["exact", "compatible", "adjacent", "conflicting", "unknown"]);
export type DocumentationApplicabilityState = z.infer<typeof documentationApplicabilityStateSchema>;

export const documentationApplicabilityEvidenceSchema = z.object({
  field: z.enum(["product", "version", "update", "cpuFamily", "firmware", "language", "locale"]),
  targetValue: z.string().min(1).max(120),
  sourceValue: z.string().min(1).max(120).nullable(),
  relation: z.enum(["exact", "missing", "different"]),
}).strict();
export type DocumentationApplicabilityEvidence = z.infer<typeof documentationApplicabilityEvidenceSchema>;

export const documentationApplicabilitySchema = z.object({
  state: documentationApplicabilityStateSchema,
  evidence: z.array(documentationApplicabilityEvidenceSchema).max(20),
  reasons: z.array(z.string().min(1).max(300)).min(1).max(20),
  explicitScope: z.string().min(1).max(2_000).nullable(),
}).strict();
export type DocumentationApplicability = z.infer<typeof documentationApplicabilitySchema>;

export const documentationSourceSchema = z.object({
  sourceId: sha256DigestSchema,
  kind: documentationSourceKindSchema,
  authority: z.literal("official-documentation"),
  title: z.string().min(1).max(500),
  product: z.string().min(1).max(120),
  version: z.string().min(1).max(40).nullable(),
  update: z.string().min(1).max(40).nullable(),
  locale: z.string().min(2).max(20),
  canonicalUrl: z.string().url().max(2_000).nullable(),
  rightsStatus: documentationRightsStatusSchema,
  state: documentationSourceStateSchema,
  extractionMethod: z.string().min(1).max(120),
  contentDigest: sha256DigestSchema.nullable(),
  indexedAt: timestampSchema.nullable(),
  statusNote: z.string().min(1).max(500),
  attributes: z.record(z.string(), z.unknown()),
}).strict();
export type DocumentationSource = z.infer<typeof documentationSourceSchema>;

export const documentationTopicSchema = z.object({
  topicId: sha256DigestSchema,
  sourceId: sha256DigestSchema,
  stableKey: z.string().min(1).max(1_000),
  title: z.string().min(1).max(500),
  aliases: z.array(z.string().min(1).max(500)).max(50),
  product: z.string().min(1).max(120),
  version: z.string().min(1).max(40).nullable(),
  update: z.string().min(1).max(40).nullable(),
  locale: z.string().min(2).max(20),
  contentDigest: sha256DigestSchema,
  contentLength: z.number().int().nonnegative(),
  excerpt: z.string().max(2_000),
  explicitScope: z.string().min(1).max(2_000).nullable(),
  attributes: z.record(z.string(), z.unknown()),
}).strict();
export type DocumentationTopic = z.infer<typeof documentationTopicSchema>;

export const documentationCitationSchema = z.object({
  citationId: sha256DigestSchema,
  sourceId: sha256DigestSchema,
  topicId: sha256DigestSchema,
  sourceKind: documentationSourceKindSchema,
  sourceTitle: z.string().min(1).max(500),
  topicTitle: z.string().min(1).max(500),
  product: z.string().min(1).max(120),
  version: z.string().min(1).max(40).nullable(),
  update: z.string().min(1).max(40).nullable(),
  locale: z.string().min(2).max(20),
  applicability: documentationApplicabilitySchema,
  canonicalUrl: z.string().url().max(2_000).nullable(),
  indexedAt: timestampSchema,
}).strict();
export type DocumentationCitation = z.infer<typeof documentationCitationSchema>;

export const documentationMatchKindSchema = z.enum(["exact-key", "exact-title", "exact-alias", "lexical"]);
export type DocumentationMatchKind = z.infer<typeof documentationMatchKindSchema>;

export const documentationRetrievalHitSchema = z.object({
  source: documentationSourceSchema,
  topic: documentationTopicSchema,
  matchKind: documentationMatchKindSchema,
  score: z.number().finite().nonnegative(),
  snippet: z.string().min(1).max(2_000),
  applicability: documentationApplicabilitySchema,
  citation: documentationCitationSchema,
}).strict();
export type DocumentationRetrievalHit = z.infer<typeof documentationRetrievalHitSchema>;

export const documentationSearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(500),
  limit: z.number().int().positive().max(100).default(20),
  target: documentationTargetSchema,
  allowAdjacent: z.boolean().default(false),
}).strict();
export type DocumentationSearchRequest = z.infer<typeof documentationSearchRequestSchema>;

export const documentationSearchResponseSchema = z.object({
  query: z.string().min(1).max(500),
  target: documentationTargetSchema,
  hits: z.array(documentationRetrievalHitSchema).max(100),
  partial: z.boolean(),
  statusNote: z.string().min(1).max(500),
}).strict();
export type DocumentationSearchResponse = z.infer<typeof documentationSearchResponseSchema>;

export const documentationStatusResponseSchema = z.object({
  sources: z.array(documentationSourceSchema).max(100),
  topicCount: z.number().int().nonnegative(),
  currentSourceCount: z.number().int().nonnegative(),
  blockedSourceCount: z.number().int().nonnegative(),
  partial: z.boolean(),
  statusNote: z.string().min(1).max(500),
}).strict();
export type DocumentationStatusResponse = z.infer<typeof documentationStatusResponseSchema>;

export const authorizedConventionExampleSchema = z.object({
  authorization: z.literal("host-authorized"),
  evidenceId: sha256DigestSchema,
  sourceId: z.string().min(1).max(500),
  citation: z.string().min(1).max(2_000),
  excerpt: z.string().min(1).max(2_000),
  observedAt: timestampSchema,
  objectKind: z.string().min(1).max(200),
  name: z.string().min(1).max(500),
}).strict();
export type AuthorizedConventionExamplePayload = z.infer<typeof authorizedConventionExampleSchema>;

export const createConventionProposalRequestSchema = z.object({
  examples: z.array(authorizedConventionExampleSchema).min(1).max(500),
}).strict();
export type CreateConventionProposalRequest = z.infer<typeof createConventionProposalRequestSchema>;

export const conventionProposalDecisionRequestSchema = z.object({
  action: z.enum(["approve", "reject"]),
  decidedBy: z.string().min(1).max(200),
  note: z.string().min(1).max(2_000),
}).strict();
export type ConventionProposalDecisionRequest = z.infer<typeof conventionProposalDecisionRequestSchema>;

export const conventionConfidenceSchema = z.enum(["low", "medium", "high"]);
export type ConventionConfidence = z.infer<typeof conventionConfidenceSchema>;

export const conventionEvidenceSchema = z.object({
  evidenceId: sha256DigestSchema,
  authority: z.enum(["observed-project", "official-documentation"]),
  sourceId: z.string().min(1).max(500),
  citation: z.string().min(1).max(2_000),
  excerpt: z.string().min(1).max(2_000),
  observedAt: timestampSchema,
}).strict();
export type ConventionEvidence = z.infer<typeof conventionEvidenceSchema>;

export const conventionDraftSchema = z.object({
  conventionId: sha256DigestSchema,
  state: z.literal("proposed"),
  title: z.string().min(1).max(300),
  rule: z.string().min(1).max(4_000),
  rationale: z.string().min(1).max(4_000),
  scope: z.array(z.string().min(1).max(300)).min(1).max(50),
  evidence: z.array(conventionEvidenceSchema).min(1).max(100),
  exceptions: z.array(z.string().min(1).max(1_000)).max(50),
  confidence: conventionConfidenceSchema,
  createdAt: timestampSchema,
  createdBy: z.literal("simon-inference"),
}).strict();
export type ConventionDraft = z.infer<typeof conventionDraftSchema>;

export const conventionDecisionActionSchema = z.enum(["approve", "reject", "retire", "supersede"]);
export type ConventionDecisionAction = z.infer<typeof conventionDecisionActionSchema>;

export const conventionDecisionSchema = z.object({
  decisionId: idSchema,
  action: conventionDecisionActionSchema,
  decidedAt: timestampSchema,
  decidedBy: z.string().min(1).max(200),
  note: z.string().min(1).max(2_000),
  hostRecorded: z.literal(true),
}).strict();
export type ConventionDecision = z.infer<typeof conventionDecisionSchema>;

export const reviseConventionRequestSchema = z.object({
  title: z.string().min(1).max(300),
  rule: z.string().min(1).max(4_000),
  rationale: z.string().min(1).max(4_000),
  scope: z.array(z.string().min(1).max(300)).min(1).max(50),
  evidence: z.array(conventionEvidenceSchema).min(1).max(100),
  exceptions: z.array(z.string().min(1).max(1_000)).max(50),
  decidedBy: z.string().min(1).max(200),
  note: z.string().min(1).max(2_000),
}).strict();
export type ReviseConventionRequest = z.infer<typeof reviseConventionRequestSchema>;

export const retireConventionRequestSchema = z.object({
  decidedBy: z.string().min(1).max(200),
  note: z.string().min(1).max(2_000),
}).strict();
export type RetireConventionRequest = z.infer<typeof retireConventionRequestSchema>;

export const conventionRevisionStateSchema = z.enum(["approved", "retired", "superseded"]);
export type ConventionRevisionState = z.infer<typeof conventionRevisionStateSchema>;

export const conventionRevisionSchema = z.object({
  revisionId: sha256DigestSchema,
  conventionId: sha256DigestSchema,
  revision: z.number().int().positive(),
  state: conventionRevisionStateSchema,
  title: z.string().min(1).max(300),
  rule: z.string().min(1).max(4_000),
  rationale: z.string().min(1).max(4_000),
  scope: z.array(z.string().min(1).max(300)).min(1).max(50),
  evidence: z.array(conventionEvidenceSchema).min(1).max(100),
  exceptions: z.array(z.string().min(1).max(1_000)).max(50),
  approvedAt: timestampSchema,
  decision: conventionDecisionSchema,
  supersedesRevisionId: sha256DigestSchema.nullable(),
}).strict();
export type ConventionRevision = z.infer<typeof conventionRevisionSchema>;

export const approvedConventionSearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(500),
  limit: z.number().int().positive().max(100).default(20),
}).strict();
export type ApprovedConventionSearchRequest = z.infer<typeof approvedConventionSearchRequestSchema>;

export const approvedConventionSearchHitSchema = z.object({
  authority: z.literal("approved-convention"),
  revision: conventionRevisionSchema,
  score: z.number().finite().nonnegative(),
  snippet: z.string().min(1).max(2_000),
}).strict();
export type ApprovedConventionSearchHit = z.infer<typeof approvedConventionSearchHitSchema>;

export const approvedConventionSearchResponseSchema = z.object({
  query: z.string().min(1).max(500),
  hits: z.array(approvedConventionSearchHitSchema).max(100),
}).strict();
export type ApprovedConventionSearchResponse = z.infer<typeof approvedConventionSearchResponseSchema>;

export const conventionCheckResultSchema = z.object({
  checkKind: z.literal("deterministic-text-check"),
  revisionId: sha256DigestSchema,
  subject: z.string().min(1).max(1_000),
  status: z.enum(["conforms", "deviation", "not-applicable", "unknown"]),
  explanation: z.string().min(1).max(2_000),
  functionalVerification: z.literal(false),
}).strict();
export type ConventionCheckResult = z.infer<typeof conventionCheckResultSchema>;

export const conventionStatusResponseSchema = z.object({
  proposed: z.array(conventionDraftSchema).max(1_000),
  active: z.array(conventionRevisionSchema).max(1_000),
  retired: z.array(conventionRevisionSchema).max(1_000),
  rejectedCount: z.number().int().nonnegative(),
}).strict();
export type ConventionStatusResponse = z.infer<typeof conventionStatusResponseSchema>;

export const citedEngineeringReferenceSchema = engineeringReferenceSchema.extend({
  citation: engineeringCitationSchema,
}).strict();
export type CitedEngineeringReference = z.infer<typeof citedEngineeringReferenceSchema>;

export const engineeringReferenceSearchResponseSchema = z.object({
  snapshot: engineeringSnapshotSchema,
  symbol: z.string().min(1).max(1_000),
  references: z.array(citedEngineeringReferenceSchema).max(100),
  partial: z.boolean(),
}).strict();
export type EngineeringReferenceSearchResponse = z.infer<typeof engineeringReferenceSearchResponseSchema>;

export const conversationSchema = z.object({
  conversationId: idSchema,
  piSessionId: z.string().min(1).nullable(),
  title: z.string().trim().min(1).max(120),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  selectedModel: z.string().min(1).nullable(),
  thinkingLevel: z.string().min(1).nullable(),
  approvalMode: approvalModeSchema,
  status: conversationStatusSchema,
  projectBinding: projectBindingSchema.nullable().default(null),
});
export type Conversation = z.infer<typeof conversationSchema>;

export const chatMessageSchema = z.object({
  messageId: z.string().min(1),
  role: z.enum(["user", "assistant"]),
  text: z.string(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const conversationMessagesSchema = z.object({
  messages: z.array(chatMessageSchema),
});
export type ConversationMessages = z.infer<typeof conversationMessagesSchema>;

export const conversationListSchema = z.object({
  conversations: z.array(conversationSchema),
});
export type ConversationList = z.infer<typeof conversationListSchema>;

export const conversationSearchResultSchema = z.object({
  conversation: conversationSchema,
  excerpt: z.string(),
  matchedRole: z.enum(["title", "user", "assistant"]),
});
export type ConversationSearchResult = z.infer<typeof conversationSearchResultSchema>;

export const conversationSearchResponseSchema = z.object({
  query: z.string(),
  results: z.array(conversationSearchResultSchema),
});

export const knowledgeSourceSchema = z.object({
  sourceId: z.string().min(1),
  title: z.string().min(1),
  objectPath: z.string().min(1),
  excerpt: z.string().min(1),
  provenance: z.enum(["synthetic_fixture", "official_documentation", "project_snapshot"]),
  synthetic: z.boolean(),
});
export type KnowledgeSource = z.infer<typeof knowledgeSourceSchema>;

export const knowledgeSearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(500),
});
export type KnowledgeSearchRequest = z.infer<typeof knowledgeSearchRequestSchema>;

export const knowledgeSearchResponseSchema = z.object({
  query: z.string(),
  sources: z.array(knowledgeSourceSchema).max(10),
  coverage: z.object({
    complete: z.boolean(),
    note: z.string(),
  }),
});
export type KnowledgeSearchResponse = z.infer<typeof knowledgeSearchResponseSchema>;

export const usageWindowSchema = z.object({
  label: z.enum(["5h", "7d"]),
  usedPercent: z.number().min(0).max(100),
  resetAt: timestampSchema,
  resetAfterSeconds: z.number().int().nonnegative(),
});
export type UsageWindow = z.infer<typeof usageWindowSchema>;

export const usageStatusSchema = z.object({
  available: z.boolean(),
  planType: z.string().optional(),
  primary: usageWindowSchema.optional(),
  secondary: usageWindowSchema.optional(),
  reason: z.string().optional(),
  checkedAt: timestampSchema,
});
export type UsageStatus = z.infer<typeof usageStatusSchema>;

export const assistantStatusSchema = z.object({
  available: z.boolean(),
  runtime: z.string().min(1),
  reason: z.string().optional(),
  modelCount: z.number().int().nonnegative(),
  capabilities: z.object({
    tools: z.array(z.string()),
    externalAccess: z.boolean(),
    mutations: z.boolean(),
    scope: z.string().min(1),
  }),
});
export type AssistantStatus = z.infer<typeof assistantStatusSchema>;

export const runtimeModelSchema = z.object({
  provider: z.string().min(1),
  id: z.string().min(1),
  name: z.string().min(1),
  reasoning: z.boolean(),
});
export type RuntimeModel = z.infer<typeof runtimeModelSchema>;

export const runtimeOptionsSchema = z.object({
  activeModel: z.string().nullable(),
  thinkingLevel: z.string().nullable(),
  models: z.array(runtimeModelSchema),
  thinkingLevels: z.array(z.string()),
});
export type RuntimeOptions = z.infer<typeof runtimeOptionsSchema>;

export const updateRuntimeRequestSchema = z
  .object({
    model: z.object({ provider: z.string().min(1), id: z.string().min(1) }).optional(),
    thinkingLevel: z.string().min(1).optional(),
  })
  .refine((value) => value.model !== undefined || value.thinkingLevel !== undefined, "A runtime change is required");
export type UpdateRuntimeRequest = z.infer<typeof updateRuntimeRequestSchema>;

export const runStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "aborted",
  "failed",
  "interrupted",
]);
export type RunStatus = z.infer<typeof runStatusSchema>;

export const runSchema = z.object({
  runId: idSchema,
  conversationId: idSchema,
  startedAt: timestampSchema,
  finishedAt: timestampSchema.nullable(),
  status: runStatusSchema,
  lastSequence: z.number().int().nonnegative(),
});
export type Run = z.infer<typeof runSchema>;

export const proposalActionSchema = z.object({
  actionId: idSchema,
  operation: z.string().trim().min(1).max(80),
  targetType: z.string().trim().min(1).max(80),
  targetId: z.string().trim().min(1).max(200).nullable(),
  description: z.string().trim().min(1).max(500),
  fields: z.record(z.string(), z.unknown()),
  effectClass: z.enum(["synthetic", "local_safe", "external"]),
});
export type ProposalAction = z.infer<typeof proposalActionSchema>;

export const proposalStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "expired",
  "applied",
  "failed",
]);
export type ProposalStatus = z.infer<typeof proposalStatusSchema>;

export const proposalSchema = z.object({
  proposalId: idSchema,
  conversationId: idSchema,
  summary: z.string().trim().min(1).max(1_000),
  actions: z.array(proposalActionSchema).min(1).max(8),
  status: proposalStatusSchema,
  createdAt: timestampSchema,
  expiresAt: timestampSchema,
  contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
  synthetic: z.boolean(),
});
export type Proposal = z.infer<typeof proposalSchema>;

const eventBaseSchema = z.object({
  schemaVersion: z.literal(CONTRACT_SCHEMA_VERSION),
  runId: idSchema,
  conversationId: idSchema,
  sequence: z.number().int().positive(),
  occurredAt: timestampSchema,
});

const eventVariant = <T extends string, S extends z.ZodTypeAny>(eventType: T, payload: S) =>
  eventBaseSchema.extend({
    eventType: z.literal(eventType),
    payload,
  });

export const runStartedEventSchema = eventVariant(
  "run.started",
  z.object({ status: z.literal("running") }),
);
export const assistantTextDeltaEventSchema = eventVariant(
  "assistant.text.delta",
  z.object({ delta: z.string().min(1) }),
);
export const assistantMessageCompletedEventSchema = eventVariant(
  "assistant.message.completed",
  z.object({ messageId: idSchema, text: z.string() }),
);
export const activityStartedEventSchema = eventVariant(
  "activity.started",
  z.object({ activityId: idSchema, label: z.string().min(1), detail: z.string().optional() }),
);
export const activityUpdatedEventSchema = eventVariant(
  "activity.updated",
  z.object({ activityId: idSchema, label: z.string().min(1).optional(), detail: z.string().optional() }),
);
export const activityCompletedEventSchema = eventVariant(
  "activity.completed",
  z.object({ activityId: idSchema, outcome: z.enum(["completed", "failed", "aborted"]) }),
);
export const knowledgeSourcesEventSchema = eventVariant(
  "knowledge.sources",
  z.object({ result: knowledgeSearchResponseSchema }),
);
export const proposalReadyEventSchema = eventVariant(
  "proposal.ready",
  z.object({ proposal: proposalSchema }),
);
export const reviewRequiredEventSchema = eventVariant(
  "review.required",
  z.object({ proposalId: idSchema }),
);
export const runCompletedEventSchema = eventVariant(
  "run.completed",
  z.object({ status: z.literal("completed") }),
);
export const runAbortedEventSchema = eventVariant(
  "run.aborted",
  z.object({ status: z.literal("aborted"), reason: z.string().optional() }),
);
export const runFailedEventSchema = eventVariant(
  "run.failed",
  z.object({ status: z.literal("failed"), code: z.string().min(1), message: z.string().min(1) }),
);
export const heartbeatEventSchema = eventVariant(
  "heartbeat",
  z.object({}),
);

export const streamEventSchema = z.discriminatedUnion("eventType", [
  runStartedEventSchema,
  assistantTextDeltaEventSchema,
  assistantMessageCompletedEventSchema,
  activityStartedEventSchema,
  activityUpdatedEventSchema,
  activityCompletedEventSchema,
  knowledgeSourcesEventSchema,
  proposalReadyEventSchema,
  reviewRequiredEventSchema,
  runCompletedEventSchema,
  runAbortedEventSchema,
  runFailedEventSchema,
  heartbeatEventSchema,
]);
export type StreamEvent = z.infer<typeof streamEventSchema>;
export type StreamEventType = StreamEvent["eventType"];

export const createConversationRequestSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  approvalMode: approvalModeSchema.default("manual"),
});
export type CreateConversationRequest = z.input<typeof createConversationRequestSchema>;

export const updateConversationRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    approvalMode: approvalModeSchema.optional(),
    selectedModel: z.string().min(1).nullable().optional(),
    thinkingLevel: z.string().min(1).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");
export type UpdateConversationRequest = z.infer<typeof updateConversationRequestSchema>;

export const createRunRequestSchema = z.object({
  message: z.string().trim().min(1).max(50_000),
});
export type CreateRunRequest = z.infer<typeof createRunRequestSchema>;

export const conversationBranchSchema = z.object({
  branchId: z.string().min(1),
  current: z.boolean(),
  updatedAt: timestampSchema,
  messageCount: z.number().int().nonnegative(),
  preview: z.string(),
});
export type ConversationBranch = z.infer<typeof conversationBranchSchema>;

export const conversationBranchListSchema = z.object({
  branches: z.array(conversationBranchSchema),
});

export const editRunRequestSchema = z.object({
  userMessageIndex: z.number().int().nonnegative(),
  message: z.string().trim().min(1).max(50_000),
});
export type EditRunRequest = z.infer<typeof editRunRequestSchema>;

export const createRunResponseSchema = z.object({
  runId: idSchema,
});
export type CreateRunResponse = z.infer<typeof createRunResponseSchema>;

export const proposalDecisionSchema = z.object({
  contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
  decision: z.enum(["approve", "reject", "revise"]),
});
export type ProposalDecision = z.infer<typeof proposalDecisionSchema>;

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  correlationId: z.string().min(1),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
