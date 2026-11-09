import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import {
  apiErrorSchema,
  createConversationRequestSchema,
  createRunRequestSchema,
  editRunRequestSchema,
  knowledgeSearchRequestSchema,
  proposalDecisionSchema,
  updateConversationRequestSchema,
  updateRuntimeRequestSchema,
  type ApiError,
  type StreamEvent,
} from "@simon/contracts";
import type { AssistantRuntime } from "./assistant-runtime.js";
import { FakeAssistant } from "./fake-assistant.js";
import { KnowledgeService } from "./knowledge-service.js";
import { ProposalConflictError, ProposalService } from "./proposal-service.js";
import { InMemoryStore } from "./store.js";
import { UsageService } from "./usage-service.js";

export interface BuildAppOptions {
  store?: InMemoryStore;
  assistant?: AssistantRuntime;
  logger?: boolean;
  usageService?: UsageService;
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
    store.close();
  });

  app.get("/api/v1/status", async () => assistant.getStatus());

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
