import {
  assistantStatusSchema,
  conversationBranchListSchema,
  conversationListSchema,
  conversationSearchResponseSchema,
  conversationMessagesSchema,
  conversationSchema,
  createRunResponseSchema,
  engineeringCapabilitiesSchema,
  engineeringDiagnosticsSchema,
  engineeringInventorySchema,
  engineeringProcessListSchema,
  engineeringReferenceSearchResponseSchema,
  engineeringSearchResponseSchema,
  engineeringSnapshotSchema,
  engineeringSnapshotStatusResponseSchema,
  engineeringStatusSchema,
  projectBindingSchema,
  knowledgeSearchResponseSchema,
  proposalSchema,
  runtimeOptionsSchema,
  usageStatusSchema,
  streamEventSchema,
  type AssistantStatus,
  type ChatMessage,
  type Conversation,
  type ConversationBranch,
  type ConversationSearchResult,
  type EngineeringCapabilities,
  type EngineeringDiagnostics,
  type EngineeringInventory,
  type EngineeringReferenceSearchResponse,
  type EngineeringSearchResponse,
  type EngineeringSnapshot,
  type EngineeringStatus,
  type KnowledgeSearchResponse,
  type ProjectBinding,
  type TiaProcess,
  type Proposal,
  type RuntimeOptions,
  type UsageStatus,
  type StreamEvent,
} from "@simon/contracts";

async function parseJson(response: Response): Promise<unknown> {
  const body = await response.json();
  if (!response.ok) throw new Error(typeof body?.message === "string" ? body.message : "Request failed");
  return body;
}

export async function searchSyntheticKnowledge(query: string): Promise<KnowledgeSearchResponse> {
  const response = await fetch("/api/v1/knowledge/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return knowledgeSearchResponseSchema.parse(await parseJson(response));
}

export async function getUsageStatus(): Promise<UsageStatus> {
  const response = await fetch("/api/v1/usage");
  return usageStatusSchema.parse(await parseJson(response));
}

export async function getAssistantStatus(): Promise<AssistantStatus> {
  const response = await fetch("/api/v1/status");
  return assistantStatusSchema.parse(await parseJson(response));
}

export async function getEngineeringStatus(conversationId?: string): Promise<EngineeringStatus> {
  const query = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : "";
  const response = await fetch(`/api/v1/engineering/status${query}`);
  return engineeringStatusSchema.parse(await parseJson(response));
}

export async function listEngineeringProcesses(): Promise<TiaProcess[]> {
  const response = await fetch("/api/v1/engineering/processes");
  return engineeringProcessListSchema.parse(await parseJson(response)).processes;
}

export async function attachEngineeringProcess(
  conversationId: string,
  target: { processId: number; processStartTime: string },
): Promise<ProjectBinding> {
  const response = await fetch(`/api/v1/conversations/${conversationId}/engineering-binding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(target),
  });
  return projectBindingSchema.parse(await parseJson(response));
}

export async function detachEngineeringProcess(): Promise<void> {
  const response = await fetch("/api/v1/engineering/connection", { method: "DELETE" });
  if (!response.ok) await parseJson(response);
}

export async function getEngineeringCapabilities(): Promise<EngineeringCapabilities> {
  const response = await fetch("/api/v1/engineering/capabilities");
  return engineeringCapabilitiesSchema.parse(await parseJson(response));
}

export async function getEngineeringDiagnostics(): Promise<EngineeringDiagnostics> {
  const response = await fetch("/api/v1/engineering/diagnostics");
  return engineeringDiagnosticsSchema.parse(await parseJson(response));
}

export async function getEngineeringInventory(conversationId: string): Promise<EngineeringInventory> {
  const response = await fetch(`/api/v1/conversations/${conversationId}/engineering-inventory`);
  return engineeringInventorySchema.parse(await parseJson(response));
}

export async function getEngineeringSnapshot(conversationId: string): Promise<EngineeringSnapshot | null> {
  const response = await fetch(`/api/v1/conversations/${conversationId}/engineering-snapshot`);
  return engineeringSnapshotStatusResponseSchema.parse(await parseJson(response)).snapshot;
}

export async function refreshEngineeringSnapshot(conversationId: string, forceRefresh = false): Promise<EngineeringSnapshot> {
  const response = await fetch(`/api/v1/conversations/${conversationId}/engineering-snapshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ forceRefresh }),
  });
  return engineeringSnapshotSchema.parse(await parseJson(response));
}

export async function searchEngineeringSnapshot(conversationId: string, query: string): Promise<EngineeringSearchResponse> {
  const response = await fetch(`/api/v1/conversations/${conversationId}/engineering-search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit: 20 }),
  });
  return engineeringSearchResponseSchema.parse(await parseJson(response));
}

export async function findEngineeringReferences(conversationId: string, symbol: string): Promise<EngineeringReferenceSearchResponse> {
  const response = await fetch(`/api/v1/conversations/${conversationId}/engineering-references?symbol=${encodeURIComponent(symbol)}`);
  return engineeringReferenceSearchResponseSchema.parse(await parseJson(response));
}

export async function searchConversations(query: string): Promise<ConversationSearchResult[]> {
  const response = await fetch(`/api/v1/conversations/search?q=${encodeURIComponent(query)}`);
  return conversationSearchResponseSchema.parse(await parseJson(response)).results;
}

export async function listConversations(): Promise<Conversation[]> {
  const response = await fetch("/api/v1/conversations");
  return conversationListSchema.parse(await parseJson(response)).conversations;
}

export async function getConversationBranches(conversationId: string): Promise<ConversationBranch[]> {
  const response = await fetch(`/api/v1/conversations/${conversationId}/branches`);
  return conversationBranchListSchema.parse(await parseJson(response)).branches;
}

export async function selectConversationBranch(conversationId: string, branchId: string): Promise<void> {
  const response = await fetch(`/api/v1/conversations/${conversationId}/branches/${branchId}/select`, { method: "POST" });
  if (!response.ok) await parseJson(response);
}

export async function getConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  const response = await fetch(`/api/v1/conversations/${conversationId}/messages`);
  return conversationMessagesSchema.parse(await parseJson(response)).messages;
}

export async function updateConversation(
  conversationId: string,
  changes: { title?: string; approvalMode?: "manual" | "auto" },
): Promise<Conversation> {
  const response = await fetch(`/api/v1/conversations/${conversationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  return conversationSchema.parse(await parseJson(response));
}

export async function deleteAllConversations(): Promise<void> {
  const response = await fetch("/api/v1/conversations", { method: "DELETE" });
  if (!response.ok) await parseJson(response);
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const response = await fetch(`/api/v1/conversations/${conversationId}`, { method: "DELETE" });
  if (!response.ok) await parseJson(response);
}

export async function createConversation(approvalMode: "manual" | "auto" = "manual"): Promise<Conversation> {
  const response = await fetch("/api/v1/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approvalMode }),
  });
  return conversationSchema.parse(await parseJson(response));
}

export async function getRuntimeOptions(conversationId: string): Promise<RuntimeOptions> {
  const response = await fetch(`/api/v1/conversations/${conversationId}/runtime`);
  return runtimeOptionsSchema.parse(await parseJson(response));
}

export async function updateRuntime(
  conversationId: string,
  update: { model?: { provider: string; id: string }; thinkingLevel?: string },
): Promise<RuntimeOptions> {
  const response = await fetch(`/api/v1/conversations/${conversationId}/runtime`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  return runtimeOptionsSchema.parse(await parseJson(response));
}

export async function createDemoProposal(conversationId: string): Promise<Proposal> {
  const response = await fetch(`/api/v1/conversations/${conversationId}/demo-proposals`, { method: "POST" });
  return proposalSchema.parse(await parseJson(response));
}

export async function decideProposal(
  proposalId: string,
  contentDigest: string,
  decision: "approve" | "reject" | "revise",
): Promise<Proposal> {
  const response = await fetch(`/api/v1/proposals/${proposalId}/decisions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentDigest, decision }),
  });
  return proposalSchema.parse(await parseJson(response));
}

export async function editAndResendRun(conversationId: string, userMessageIndex: number, message: string): Promise<string> {
  const response = await fetch(`/api/v1/conversations/${conversationId}/edit-and-resend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userMessageIndex, message }),
  });
  return createRunResponseSchema.parse(await parseJson(response)).runId;
}

export async function regenerateRun(conversationId: string): Promise<string> {
  const response = await fetch(`/api/v1/conversations/${conversationId}/regenerate`, { method: "POST" });
  return createRunResponseSchema.parse(await parseJson(response)).runId;
}

export async function createRun(conversationId: string, message: string): Promise<string> {
  const response = await fetch(`/api/v1/conversations/${conversationId}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return createRunResponseSchema.parse(await parseJson(response)).runId;
}

export async function abortConversation(conversationId: string): Promise<void> {
  const response = await fetch(`/api/v1/conversations/${conversationId}/abort`, { method: "POST" });
  await parseJson(response);
}

export type RunConnectionState =
  | { status: "connected" }
  | { status: "reconnecting"; attempt: number; delayMs: number }
  | { status: "recovered" }
  | { status: "exhausted" };

export function watchRun(
  runId: string,
  onEvent: (event: StreamEvent) => void,
  onError: (error: Error) => void,
  onConnectionState?: (state: RunConnectionState) => void,
): () => void {
  const eventTypes: StreamEvent["eventType"][] = [
    "run.started",
    "assistant.text.delta",
    "assistant.message.completed",
    "activity.started",
    "activity.updated",
    "activity.completed",
    "knowledge.sources",
    "proposal.ready",
    "review.required",
    "run.completed",
    "run.aborted",
    "run.failed",
    "heartbeat",
  ];
  let source: EventSource | null = null;
  let stopped = false;
  let terminal = false;
  let attempts = 0;
  let lastSequence = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const fail = (message: string) => {
    stopped = true;
    source?.close();
    onError(new Error(message));
  };

  const connect = () => {
    if (stopped || terminal) return;
    source = new EventSource(`/api/v1/runs/${runId}/events?after=${lastSequence}`);
    source.onopen = () => {
      const recovered = attempts > 0;
      attempts = 0;
      onConnectionState?.({ status: recovered ? "recovered" : "connected" });
    };
    for (const type of eventTypes) {
      source.addEventListener(type, (raw) => {
        let json: unknown;
        try {
          json = JSON.parse((raw as MessageEvent<string>).data);
        } catch {
          fail("Received malformed assistant data");
          return;
        }
        const parsed = streamEventSchema.safeParse(json);
        if (!parsed.success) {
          fail("Received an invalid assistant event");
          return;
        }
        if (parsed.data.sequence <= lastSequence) return;
        lastSequence = parsed.data.sequence;
        onEvent(parsed.data);
        if (["run.completed", "run.aborted", "run.failed"].includes(parsed.data.eventType)) {
          terminal = true;
          source?.close();
        }
      });
    }
    source.onerror = () => {
      source?.close();
      if (stopped || terminal) return;
      attempts += 1;
      if (attempts > 5) {
        onConnectionState?.({ status: "exhausted" });
        fail("Assistant connection interrupted after repeated reconnect attempts");
        return;
      }
      const delay = Math.min(500 * 2 ** (attempts - 1), 2_000);
      onConnectionState?.({ status: "reconnecting", attempt: attempts, delayMs: delay });
      reconnectTimer = setTimeout(connect, delay);
    };
  };

  connect();
  return () => {
    stopped = true;
    source?.close();
    if (reconnectTimer) clearTimeout(reconnectTimer);
  };
}
