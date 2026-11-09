import { z } from "zod";

export const CONTRACT_SCHEMA_VERSION = 1 as const;

export const idSchema = z.string().uuid();
export const timestampSchema = z.string().datetime({ offset: true });

export const approvalModeSchema = z.enum(["manual", "auto"]);
export type ApprovalMode = z.infer<typeof approvalModeSchema>;

export const conversationStatusSchema = z.enum([
  "idle",
  "running",
  "waiting_for_review",
  "failed",
  "interrupted",
]);
export type ConversationStatus = z.infer<typeof conversationStatusSchema>;

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
