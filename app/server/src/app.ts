import { createHash, randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import {
  apiErrorSchema,
  attachEngineeringRequestSchema,
  createEngineeringSnapshotRequestSchema,
  createConversationRequestSchema,
  createRunRequestSchema,
  editRunRequestSchema,
  engineeringSearchRequestSchema,
  knowledgeSearchRequestSchema,
  proposalDecisionSchema,
  updateConversationRequestSchema,
  updateRuntimeRequestSchema,
  type ApiError,
  type StreamEvent,
} from "@simon/contracts";
import type { AssistantRuntime } from "./assistant-runtime.js";
import { EngineeringConnectionManager, type EngineeringConnection } from "./engineering-connection.js";
import { AmbiguousEngineeringQueryError, EngineeringRetrievalService } from "./engineering-retrieval.js";
import type { EngineeringSnapshotService } from "./engineering-snapshot.js";
import { FakeAssistant } from "./fake-assistant.js";
import { KnowledgeService } from "./knowledge-service.js";
import { ProposalConflictError, ProposalService } from "./proposal-service.js";
import { getRuntimePolicy } from "./runtime-policy.js";
import { InMemoryStore } from "./store.js";
import { UsageService } from "./usage-service.js";

export interface BuildAppOptions {
  store?: InMemoryStore;
  assistant?: AssistantRuntime;
  logger?: boolean;
  usageService?: UsageService;
  engineering?: EngineeringConnection;
  snapshots?: EngineeringSnapshotService;
  engineeringRetrieval?: EngineeringRetrievalService;
}

function apiError(code: string, message: string): ApiError {
  return apiErrorSchema.parse({ code, message, correlationId: randomUUID() });
}

function formatSse(event: StreamEvent): string {
  return `id: ${event.sequence}\nevent: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });
  const store = options.store ?? new InMemoryStore();
  const assistant: AssistantRuntime = options.assistant ?? new FakeAssistant(store);
  const proposals = new ProposalService(store);
  const knowledge = new KnowledgeService();
  const usage = options.usageService ?? new UsageService();
  const engineering = options.engineering ?? new EngineeringConnectionManager(store, getRuntimePolicy({}), null);
  const snapshots = options.snapshots;
  const engineeringRetrieval = options.engineeringRetrieval ?? new EngineeringRetrievalService();
  const currentSnapshotCapture = (conversationId: string) => {
    if (!snapshots) throw new Error("Engineering snapshot service is unavailable.");
    const status = engineering.getStatus(conversationId);
    if (status.state !== "connected" || !status.binding || !status.conversationBindingMatches) {
      throw new Error("A current conversation-scoped engineering binding is required.");
    }
    const capture = snapshots.getLatest(conversationId);
    const persisted = store.getLatestEngineeringSnapshot(conversationId);
    if (!capture?.records || !persisted || capture.snapshot.snapshotId !== persisted.snapshotId) {
      throw new Error("Create a current engineering snapshot before retrieval.");
    }
    if (persisted.freshness !== "current" || !["completed", "partial"].includes(persisted.state)) {
      throw new Error("The engineering snapshot is stale or incomplete; refresh it before retrieval.");
    }
    if (persisted.binding.bindingId !== status.binding.bindingId || persisted.binding.epoch !== status.binding.epoch) {
      throw new Error("The engineering snapshot does not match the current conversation binding.");
    }
    return { snapshot: persisted, records: capture.records };
  };

  app.decorate("simonStore", store);

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    reply.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    return payload;
  });

  app.addHook("onClose", async () => {
    await assistant.dispose?.();
    await engineering.close();
    store.close();
  });

  app.get("/api/v1/status", async () => assistant.getStatus());

  app.get<{ Querystring: { conversationId?: string } }>("/api/v1/engineering/status", async (request) =>
    engineering.getStatus(request.query.conversationId));

  app.get("/api/v1/engineering/processes", async (_request, reply) => {
    try {
      return await engineering.listProcesses();
    } catch (error) {
      const message = error instanceof Error ? error.message : "TIA process discovery failed";
      return reply.code(409).send(apiError("engineering_discovery_failed", message));
    }
  });

  app.get("/api/v1/engineering/capabilities", async () => engineering.getCapabilities());
  app.get("/api/v1/engineering/diagnostics", async () => engineering.getDiagnostics());

  app.post<{ Params: { conversationId: string } }>(
    "/api/v1/conversations/:conversationId/engineering-binding",
    async (request, reply) => {
      const parsed = attachEngineeringRequestSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send(apiError("invalid_request", "Invalid TIA process selection"));
      try {
        const binding = await engineering.attach(request.params.conversationId, parsed.data);
        await assistant.disposeConversation?.(request.params.conversationId);
        return reply.code(201).send(binding);
      } catch (error) {
        const message = error instanceof Error ? error.message : "TIA attachment failed";
        return reply.code(409).send(apiError("engineering_attachment_failed", message));
      }
    },
  );

  app.delete("/api/v1/engineering/connection", async (_request, reply) => {
    try {
      await engineering.detach();
      return reply.code(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : "TIA disconnect failed";
      return reply.code(409).send(apiError("engineering_disconnect_failed", message));
    }
  });

  app.get<{ Params: { conversationId: string } }>(
    "/api/v1/conversations/:conversationId/engineering-inventory",
    async (request, reply) => {
      try {
        return await engineering.getInventory(request.params.conversationId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Engineering inventory failed";
        return reply.code(409).send(apiError("engineering_inventory_failed", message));
      }
    },
  );

  app.get<{ Params: { conversationId: string } }>(
    "/api/v1/conversations/:conversationId/engineering-snapshot",
    async (request, reply) => {
      if (!store.conversations.has(request.params.conversationId)) {
        return reply.code(404).send(apiError("conversation_not_found", "Conversation not found"));
      }
      const snapshot = store.getLatestEngineeringSnapshot(request.params.conversationId);
      return { snapshot };
    },
  );

  app.post<{ Params: { conversationId: string } }>(
    "/api/v1/conversations/:conversationId/engineering-snapshot",
    async (request, reply) => {
      if (!snapshots) return reply.code(503).send(apiError("snapshot_unavailable", "Engineering snapshot service is unavailable"));
      if (!store.conversations.has(request.params.conversationId)) {
        return reply.code(404).send(apiError("conversation_not_found", "Conversation not found"));
      }
      const parsed = createEngineeringSnapshotRequestSchema.safeParse(request.body ?? {});
      if (!parsed.success) return reply.code(400).send(apiError("invalid_request", "Invalid snapshot refresh request"));
      const controller = new AbortController();
      request.raw.once("aborted", () => controller.abort());
      try {
        const capture = await snapshots.create(
          request.params.conversationId,
          parsed.data.forceRefresh,
          controller.signal,
        );
        return reply.code(201).send(capture.snapshot);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Engineering snapshot refresh failed";
        return reply.code(409).send(apiError("engineering_snapshot_failed", message));
      }
    },
  );

  app.post<{ Params: { conversationId: string } }>(
    "/api/v1/conversations/:conversationId/engineering-search",
    async (request, reply) => {
      const parsed = engineeringSearchRequestSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send(apiError("invalid_request", "Invalid engineering search request"));
      try {
        const capture = currentSnapshotCapture(request.params.conversationId);
        return engineeringRetrieval.search(capture.snapshot, capture.records, parsed.data, store);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Engineering search failed";
        const code = error instanceof AmbiguousEngineeringQueryError ? "engineering_query_ambiguous" : "engineering_search_failed";
        return reply.code(409).send(apiError(code, message));
      }
    },
  );

  app.get<{ Params: { conversationId: string }; Querystring: { symbol?: string; limit?: string } }>(
    "/api/v1/conversations/:conversationId/engineering-references",
    async (request, reply) => {
      const symbol = request.query.symbol?.trim() ?? "";
      const parsedLimit = Number.parseInt(request.query.limit ?? "20", 10);
      if (!symbol || symbol.length > 1_000 || !Number.isSafeInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        return reply.code(400).send(apiError("invalid_request", "A valid symbol and limit are required"));
      }
      try {
        const capture = currentSnapshotCapture(request.params.conversationId);
        const limit = Math.min(parsedLimit, capture.snapshot.limits.maxResultsPerQuery);
        const references = capture.records.references
          .filter((reference) => reference.symbol.localeCompare(symbol, undefined, { sensitivity: "accent" }) === 0)
          .slice(0, limit)
          .map((reference) => ({
            ...reference,
            citation: {
              citationId: createHash("sha256")
                .update([capture.snapshot.snapshotId, reference.referenceId, reference.sourcePath].join("\0"))
                .digest("hex"),
              snapshotId: capture.snapshot.snapshotId,
              documentId: reference.referenceId,
              engineeringPath: reference.sourcePath,
              observedAt: reference.provenance.observedAt,
              freshness: capture.snapshot.freshness,
              coverage: reference.provenance.coverage,
            },
          }));
        return {
          snapshot: capture.snapshot,
          symbol,
          references,
          partial: capture.snapshot.state === "partial" || capture.snapshot.coverage.some((item) => item.state !== "complete"),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Engineering reference lookup failed";
        return reply.code(409).send(apiError("engineering_references_failed", message));
      }
    },
  );

  app.get("/api/v1/usage", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    return usage.getStatus();
  });

  app.post("/api/v1/knowledge/search", async (request, reply) => {
    const parsed = knowledgeSearchRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(apiError("invalid_request", "A search query is required"));
    }
    return knowledge.search(parsed.data.query);
  });

  app.get("/api/v1/conversations", async () => ({
    conversations: [...store.conversations.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    ),
  }));

  app.get<{ Querystring: { q?: string } }>(
    "/api/v1/conversations/search",
    async (request, reply) => {
      const query = request.query.q?.trim() ?? "";
      if (!query) return reply.code(400).send(apiError("invalid_request", "A search query is required"));
      const getMessages = assistant.getMessages?.bind(assistant);
      for (const conversation of store.conversations.values()) {
        try {
          const messages = getMessages ? await getMessages(conversation.conversationId) : [];
          store.indexConversation(conversation.conversationId, messages);
        } catch {
          // A missing or unreadable transcript must not prevent searching other local conversations.
        }
      }
      return { query, results: store.searchConversations(query) };
    },
  );

  app.get<{ Params: { conversationId: string } }>(
    "/api/v1/conversations/:conversationId",
    async (request, reply) => {
      const conversation = store.conversations.get(request.params.conversationId);
      if (!conversation) {
        return reply.code(404).send(apiError("conversation_not_found", "Conversation not found"));
      }
      return conversation;
    },
  );

  app.get<{ Params: { conversationId: string } }>(
    "/api/v1/conversations/:conversationId/messages",
    async (request, reply) => {
      if (!store.conversations.has(request.params.conversationId)) {
        return reply.code(404).send(apiError("conversation_not_found", "Conversation not found"));
      }
      if (!assistant.getMessages) {
        return reply.code(501).send(apiError("messages_unavailable", "Transcript restoration is unavailable"));
      }
      return { messages: await assistant.getMessages(request.params.conversationId) };
    },
  );

  app.get<{ Params: { conversationId: string } }>(
    "/api/v1/conversations/:conversationId/branches",
    async (request, reply) => {
      if (!store.conversations.has(request.params.conversationId)) {
        return reply.code(404).send(apiError("conversation_not_found", "Conversation not found"));
      }
      return { branches: await assistant.getBranches(request.params.conversationId) };
    },
  );

  app.post<{ Params: { conversationId: string; branchId: string } }>(
    "/api/v1/conversations/:conversationId/branches/:branchId/select",
    async (request, reply) => {
      const conversation = store.conversations.get(request.params.conversationId);
      if (!conversation) return reply.code(404).send(apiError("conversation_not_found", "Conversation not found"));
      if (conversation.status === "running") return reply.code(409).send(apiError("conversation_busy", "Conversation already has an active run"));
      await assistant.selectBranch(request.params.conversationId, request.params.branchId);
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { conversationId: string } }>(
    "/api/v1/conversations/:conversationId/runtime",
    async (request, reply) => {
      if (!store.conversations.has(request.params.conversationId)) {
        return reply.code(404).send(apiError("conversation_not_found", "Conversation not found"));
      }
      if (!assistant.getRuntimeOptions) {
        return reply.code(501).send(apiError("runtime_options_unavailable", "Runtime options are unavailable"));
      }
      return assistant.getRuntimeOptions(request.params.conversationId);
    },
  );

  app.patch<{ Params: { conversationId: string } }>(
    "/api/v1/conversations/:conversationId/runtime",
    async (request, reply) => {
      const parsed = updateRuntimeRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send(apiError("invalid_request", "Invalid runtime update"));
      }
      if (!store.conversations.has(request.params.conversationId)) {
        return reply.code(404).send(apiError("conversation_not_found", "Conversation not found"));
      }
      if (!assistant.updateRuntime) {
        return reply.code(501).send(apiError("runtime_update_unavailable", "Runtime updates are unavailable"));
      }
      try {
        return await assistant.updateRuntime(request.params.conversationId, parsed.data);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Runtime update failed";
        return reply.code(409).send(apiError("runtime_update_failed", message));
      }
    },
  );

  app.post("/api/v1/conversations", async (request, reply) => {
    const parsed = createConversationRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send(apiError("invalid_request", "Invalid conversation request"));
    }
    return reply.code(201).send(
      store.createConversation({
        title: parsed.data.title,
        approvalMode: parsed.data.approvalMode,
      }),
    );
  });

  app.patch<{ Params: { conversationId: string } }>(
    "/api/v1/conversations/:conversationId",
    async (request, reply) => {
      const parsed = updateConversationRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send(apiError("invalid_request", "Invalid conversation update"));
      }
      const changes: Parameters<InMemoryStore["updateConversation"]>[1] = {};
      if (parsed.data.title !== undefined) changes.title = parsed.data.title;
      if (parsed.data.approvalMode !== undefined) changes.approvalMode = parsed.data.approvalMode;
      if (parsed.data.selectedModel !== undefined) changes.selectedModel = parsed.data.selectedModel;
      if (parsed.data.thinkingLevel !== undefined) changes.thinkingLevel = parsed.data.thinkingLevel;
      const conversation = store.updateConversation(request.params.conversationId, changes);
      if (!conversation) {
        return reply.code(404).send(apiError("conversation_not_found", "Conversation not found"));
      }
      return conversation;
    },
  );

  app.delete("/api/v1/conversations", async (_request, reply) => {
    const conversations = [...store.conversations.values()];
    if (conversations.some((conversation) => conversation.status === "running")) {
      return reply.code(409).send(apiError("conversation_busy", "Stop active runs before deleting history"));
    }
    for (const conversation of conversations) {
      await assistant.disposeConversation?.(conversation.conversationId);
      store.deleteConversation(conversation.conversationId);
    }
    return reply.code(204).send();
  });

  app.delete<{ Params: { conversationId: string } }>(
    "/api/v1/conversations/:conversationId",
    async (request, reply) => {
      const conversation = store.conversations.get(request.params.conversationId);
      if (!conversation) {
        return reply.code(404).send(apiError("conversation_not_found", "Conversation not found"));
      }
      if (conversation.status === "running") {
        return reply.code(409).send(apiError("conversation_busy", "Stop the active run before deleting"));
      }
      await assistant.disposeConversation?.(conversation.conversationId);
      store.deleteConversation(conversation.conversationId);
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { conversationId: string } }>(
    "/api/v1/conversations/:conversationId/demo-proposals",
    async (request, reply) => {
      const conversation = store.conversations.get(request.params.conversationId);
      if (!conversation) {
        return reply.code(404).send(apiError("conversation_not_found", "Conversation not found"));
      }
      return reply.code(201).send(proposals.createDemo(conversation.conversationId, conversation.approvalMode));
    },
  );

  app.post<{ Params: { proposalId: string } }>(
    "/api/v1/proposals/:proposalId/decisions",
    async (request, reply) => {
      const parsed = proposalDecisionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send(apiError("invalid_request", "Invalid proposal decision"));
      }
      try {
        return proposals.decide(request.params.proposalId, parsed.data);
      } catch (error) {
        if (error instanceof ProposalConflictError) {
          const status = error.code === "proposal_not_found" ? 404 : 409;
          return reply.code(status).send(apiError(error.code, error.message));
        }
        throw error;
      }
    },
  );

  app.post<{ Params: { conversationId: string } }>(
    "/api/v1/conversations/:conversationId/runs",
    async (request, reply) => {
      const conversation = store.conversations.get(request.params.conversationId);
      if (!conversation) {
        return reply.code(404).send(apiError("conversation_not_found", "Conversation not found"));
      }
      if (conversation.status === "running") {
        return reply.code(409).send(apiError("conversation_busy", "Conversation already has an active run"));
      }
      const parsed = createRunRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send(apiError("invalid_request", "Message is required"));
      }

      const stored = store.createRun(conversation.conversationId);
      store.updateConversation(conversation.conversationId, { status: "running" });
      void assistant.execute(stored, parsed.data.message).catch((error: unknown) => {
        stored.run.status = "failed";
        stored.run.finishedAt = new Date().toISOString();
        store.updateConversation(conversation.conversationId, { status: "failed" });
        const message = error instanceof Error ? error.message : "Unknown assistant error";
        const event: StreamEvent = {
          schemaVersion: 1,
          runId: stored.run.runId,
          conversationId: stored.run.conversationId,
          sequence: stored.run.lastSequence + 1,
          occurredAt: new Date().toISOString(),
          eventType: "run.failed",
          payload: { status: "failed", code: "assistant_failed", message },
        };
        store.appendEvent(stored.run.runId, event);
      });
      return reply.code(202).send({ runId: stored.run.runId });
    },
  );

  app.post<{ Params: { conversationId: string } }>(
    "/api/v1/conversations/:conversationId/edit-and-resend",
    async (request, reply) => {
      const conversation = store.conversations.get(request.params.conversationId);
      if (!conversation) return reply.code(404).send(apiError("conversation_not_found", "Conversation not found"));
      if (conversation.status === "running") return reply.code(409).send(apiError("conversation_busy", "Conversation already has an active run"));
      const parsed = editRunRequestSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send(apiError("invalid_request", "A valid message and user-message index are required"));
      const stored = store.createRun(conversation.conversationId);
      store.updateConversation(conversation.conversationId, { status: "running" });
      void assistant.editAndResend(stored, parsed.data.userMessageIndex, parsed.data.message).catch((error: unknown) => {
        stored.run.status = "failed";
        stored.run.finishedAt = new Date().toISOString();
        store.updateConversation(conversation.conversationId, { status: "failed" });
        const message = error instanceof Error ? error.message : "Unknown edit error";
        store.appendEvent(stored.run.runId, {
          schemaVersion: 1, runId: stored.run.runId, conversationId: stored.run.conversationId,
          sequence: stored.run.lastSequence + 1, occurredAt: new Date().toISOString(),
          eventType: "run.failed", payload: { status: "failed", code: "edit_failed", message },
        });
      });
      return reply.code(202).send({ runId: stored.run.runId });
    },
  );

  app.post<{ Params: { conversationId: string } }>(
    "/api/v1/conversations/:conversationId/regenerate",
    async (request, reply) => {
      const conversation = store.conversations.get(request.params.conversationId);
      if (!conversation) {
        return reply.code(404).send(apiError("conversation_not_found", "Conversation not found"));
      }
      if (conversation.status === "running") {
        return reply.code(409).send(apiError("conversation_busy", "Conversation already has an active run"));
      }
      const stored = store.createRun(conversation.conversationId);
      store.updateConversation(conversation.conversationId, { status: "running" });
      void assistant.regenerate(stored).catch((error: unknown) => {
        stored.run.status = "failed";
        stored.run.finishedAt = new Date().toISOString();
        store.updateConversation(conversation.conversationId, { status: "failed" });
        const message = error instanceof Error ? error.message : "Unknown regeneration error";
        store.appendEvent(stored.run.runId, {
          schemaVersion: 1,
          runId: stored.run.runId,
          conversationId: stored.run.conversationId,
          sequence: stored.run.lastSequence + 1,
          occurredAt: new Date().toISOString(),
          eventType: "run.failed",
          payload: { status: "failed", code: "regeneration_failed", message },
        });
      });
      return reply.code(202).send({ runId: stored.run.runId });
    },
  );

  app.post<{ Params: { conversationId: string } }>(
    "/api/v1/conversations/:conversationId/abort",
    async (request, reply) => {
      const conversation = store.conversations.get(request.params.conversationId);
      if (!conversation) {
        return reply.code(404).send(apiError("conversation_not_found", "Conversation not found"));
      }
      if (conversation.status !== "running") {
        return reply.code(409).send(apiError("conversation_not_running", "Conversation has no active run"));
      }
      if (!assistant.abort) {
        return reply.code(501).send(apiError("abort_unavailable", "The active runtime cannot be stopped"));
      }
      await assistant.abort(conversation.conversationId);
      return reply.code(202).send({ status: "aborting" });
    },
  );

  app.get<{ Params: { runId: string }; Querystring: { after?: string } }>(
    "/api/v1/runs/:runId/events",
    async (request, reply) => {
      const stored = store.runs.get(request.params.runId);
      if (!stored) {
        return reply.code(404).send(apiError("run_not_found", "Run not found"));
      }
      const after = Number.parseInt(request.query.after ?? "0", 10);
      if (!Number.isFinite(after) || after < 0) {
        return reply.code(400).send(apiError("invalid_sequence", "after must be non-negative"));
      }

      reply.hijack();
      const response = reply.raw;
      response.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      response.flushHeaders();

      for (const event of stored.events) {
        if (event.sequence > after) response.write(formatSse(event));
      }

      if (["completed", "aborted", "failed", "interrupted"].includes(stored.run.status)) {
        response.end();
        return reply;
      }

      const heartbeat = setInterval(() => {
        if (!response.destroyed) response.write(": heartbeat\n\n");
      }, 15_000);
      heartbeat.unref();

      const cleanup = () => {
        clearInterval(heartbeat);
        stored.listeners.delete(listener);
      };
      const listener = (event: StreamEvent) => {
        response.write(formatSse(event));
        if (["run.completed", "run.aborted", "run.failed"].includes(event.eventType)) {
          cleanup();
          response.end();
        }
      };
      stored.listeners.add(listener);
      request.raw.on("close", cleanup);
      return reply;
    },
  );

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    simonStore: InMemoryStore;
  }
}
