import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  createAgentSession,
  createExtensionRuntime,
  getAgentDir,
  ModelRuntime,
  SessionManager,
  type AgentSession,
  type ResourceLoader,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  CONTRACT_SCHEMA_VERSION,
  knowledgeSearchResponseSchema,
  type AssistantStatus,
  type ChatMessage,
  type ConversationBranch,
  type RuntimeOptions,
  type StreamEvent,
  type UpdateRuntimeRequest,
} from "@simon/contracts";
import type { AssistantRuntime } from "./assistant-runtime.js";
import { EngineeringMcpClient } from "./engineering-mcp-client.js";
import { KnowledgeService } from "./knowledge-service.js";
import {
  assertRuntimePolicy,
  getRuntimePolicy,
  SYNTHETIC_KNOWLEDGE_TOOL_NAME,
  type RuntimePolicy,
} from "./runtime-policy.js";
import type { InMemoryStore, StoredRun } from "./store.js";

function extractMessageText(message: unknown): string {
  if (!message || typeof message !== "object" || !("content" in message)) return "";
  const content = message.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .flatMap((part) => {
      if (!part || typeof part !== "object") return [];
      if ("type" in part && part.type === "text" && "text" in part && typeof part.text === "string") {
        return [part.text];
      }
      return [];
    })
    .join("");
}

interface ManagedSession {
  session: AgentSession;
  activeRunId: string | null;
  abortRequested: boolean;
}

const knowledgeToolParameters = Type.Object({
  query: Type.String({ minLength: 1, maxLength: 500, description: "Engineering topic to search" }),
});

function createKnowledgeTool(): ToolDefinition<typeof knowledgeToolParameters> {
  const knowledge = new KnowledgeService();
  return {
    name: SYNTHETIC_KNOWLEDGE_TOOL_NAME,
    label: "Search synthetic Simon knowledge",
    description: "Search only Simon's bundled synthetic PLC engineering examples. This does not access TIA Portal, a real project, the filesystem, MCP, or the internet.",
    promptSnippet: "Search bundled synthetic PLC examples and return explicit source paths.",
    promptGuidelines: [
      "Use the synthetic knowledge tool only when the user asks about relevant example engineering content.",
      "Always disclose that results are synthetic and coverage is incomplete.",
      "Never describe a synthetic source as the user's real project.",
    ],
    parameters: knowledgeToolParameters,
    execute: async (_toolCallId, params) => {
      const result = knowledge.search(params.query);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        details: { searchResult: result },
      };
    },
  };
}

function createRestrictedResourceLoader(policy: RuntimePolicy): ResourceLoader {
  const tiaEnabled = policy.mode === "tia-readonly";
  return {
    getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () =>
      [
        "You are Simon, a concise local engineering assistant.",
        tiaEnabled
          ? "You have a restricted set of read-only TIA Portal tools provided through Simon MCP. You cannot import, compile, save, close, download to, or otherwise mutate a TIA project."
          : "This application has one read-only tool for bundled synthetic examples. It has no TIA Portal, MCP, shell, filesystem, internet, or external mutation access.",
        "Never claim an unavailable integration is connected or that an external action was completed.",
        "Treat snapshots and partial results truthfully, cite observed engineering paths, and distinguish facts, assumptions, proposals, and completed work.",
      ].join("\n"),
    getSystemPromptSource: () => undefined,
    getAppendSystemPrompt: () => [],
    getAppendSystemPromptSources: () => [],
    extendResources: () => {},
    reload: async () => {},
  };
}

export class PiAssistant implements AssistantRuntime {
  readonly name = "pi";
  private readonly sessions = new Map<string, ManagedSession>();
  private readonly modelRuntimePromise: Promise<ModelRuntime>;
  private readonly policy: RuntimePolicy;
  private readonly engineeringMcp: EngineeringMcpClient | null;

  constructor(
    private readonly store: InMemoryStore,
    private readonly cwd: string,
    private readonly sessionDirectory: string,
  ) {
    this.policy = getRuntimePolicy();
    assertRuntimePolicy(this.policy);
    this.engineeringMcp = this.policy.mode === "tia-readonly"
      ? new EngineeringMcpClient({
          command: process.execPath,
          args: [join(this.cwd, "mcp", "dist", "src", "main.js")],
          cwd: this.cwd,
        })
      : null;
    const agentDir = getAgentDir();
    this.modelRuntimePromise = ModelRuntime.create({
      authPath: join(agentDir, "auth.json"),
      modelsStorePath: join(agentDir, "models-store.json"),
      modelsPath: null,
    });
  }

  async getStatus(): Promise<AssistantStatus> {
    try {
      const modelRuntime = await this.modelRuntimePromise;
      const models = await modelRuntime.getAvailable();
      if (models.length === 0) {
        return {
          available: false,
          runtime: this.name,
          reason: modelRuntime.getError() ?? "No authenticated Pi models are available",
          modelCount: 0,
          capabilities: this.capabilities(),
        };
      }
      return {
        available: true,
        runtime: this.name,
        modelCount: models.length,
        capabilities: this.capabilities(),
      };
    } catch (error) {
      return {
        available: false,
        runtime: this.name,
        reason: error instanceof Error ? error.message : "Pi runtime initialization failed",
        modelCount: 0,
        capabilities: this.capabilities(),
      };
    }
  }

  async getBranches(conversationId: string): Promise<ConversationBranch[]> {
    const managed = await this.getOrCreateSession(conversationId);
    const manager = managed.session.sessionManager;
    const leaves: Array<{ entry: { id: string; timestamp: string } }> = [];
    const visit = (nodes: ReturnType<typeof manager.getTree>) => {
      for (const node of nodes) {
        if (node.children.length === 0) leaves.push(node);
        else visit(node.children);
      }
    };
    visit(manager.getTree());
    const currentLeafId = manager.getLeafId();
    return leaves.flatMap((leaf) => {
      const messages = manager.getBranch(leaf.entry.id)
        .filter((entry) => entry.type === "message")
        .map((entry) => entry.message);
      const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
      if (!lastAssistant) return [];
      return [{
        branchId: leaf.entry.id,
        current: leaf.entry.id === currentLeafId,
        updatedAt: leaf.entry.timestamp,
        messageCount: messages.filter((message) => message.role === "user" || message.role === "assistant").length,
        preview: extractMessageText(lastAssistant).slice(0, 120),
      }];
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async selectBranch(conversationId: string, branchId: string): Promise<void> {
    const managed = await this.getOrCreateSession(conversationId);
    if (managed.activeRunId) throw new Error("Cannot switch branches during an active run");
    const result = await managed.session.navigateTree(branchId);
    if (result.cancelled) throw new Error("Pi cancelled branch navigation");
  }

  async editAndResend(stored: StoredRun, userMessageIndex: number, message: string): Promise<void> {
    const managed = await this.getOrCreateSession(stored.run.conversationId);
    if (managed.activeRunId) throw new Error("Conversation already has an active Pi run");
    const target = managed.session.getUserMessagesForForking()[userMessageIndex];
    if (!target) throw new Error("The selected user message is unavailable");
    const navigation = await managed.session.navigateTree(target.entryId);
    if (navigation.cancelled) throw new Error("Pi cancelled message editing");
    await this.execute(stored, message);
  }

  async regenerate(stored: StoredRun): Promise<void> {
    const managed = await this.getOrCreateSession(stored.run.conversationId);
    if (managed.activeRunId) throw new Error("Conversation already has an active Pi run");
    const latest = managed.session.getUserMessagesForForking().at(-1);
    if (!latest) throw new Error("There is no user message to regenerate");
    const navigation = await managed.session.navigateTree(latest.entryId);
    if (navigation.cancelled) throw new Error("Pi cancelled response regeneration");
    await this.execute(stored, navigation.editorText ?? latest.text);
  }

  async execute(stored: StoredRun, message: string): Promise<void> {
    const managed = await this.getOrCreateSession(stored.run.conversationId);
    if (managed.activeRunId) throw new Error("Conversation already has an active Pi run");
    managed.activeRunId = stored.run.runId;
    managed.abortRequested = false;
    stored.run.status = "running";
    this.emit(stored, "run.started", { status: "running" });

    const activityId = randomUUID();
    this.emit(stored, "activity.started", {
      activityId,
      label: "Thinking",
      detail: "Pi is preparing a response",
    });

    let completedText = "";
    const toolActivities = new Map<string, string>();
    const unsubscribe = managed.session.subscribe((event) => {
      if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
        completedText += event.assistantMessageEvent.delta;
        this.emit(stored, "assistant.text.delta", { delta: event.assistantMessageEvent.delta });
      }
      if (event.type === "tool_execution_start" && this.policy.allowedTools.includes(event.toolName)) {
        const toolActivityId = randomUUID();
        toolActivities.set(event.toolCallId, toolActivityId);
        this.emit(stored, "activity.started", {
          activityId: toolActivityId,
          label: event.toolName === SYNTHETIC_KNOWLEDGE_TOOL_NAME
            ? "Searching synthetic knowledge"
            : `Reading TIA engineering context: ${event.toolName}`,
          detail: event.toolName === SYNTHETIC_KNOWLEDGE_TOOL_NAME && typeof event.args?.query === "string"
            ? event.args.query
            : undefined,
        });
      }
      if (event.type === "tool_execution_end" && this.policy.allowedTools.includes(event.toolName)) {
        const toolActivityId = toolActivities.get(event.toolCallId);
        if (toolActivityId) {
          this.emit(stored, "activity.completed", {
            activityId: toolActivityId,
            outcome: event.isError ? "failed" : "completed",
          });
          toolActivities.delete(event.toolCallId);
        }
        if (!event.isError && event.toolName === SYNTHETIC_KNOWLEDGE_TOOL_NAME) {
          const parsed = knowledgeSearchResponseSchema.safeParse(event.result?.details?.searchResult);
          if (parsed.success) this.emit(stored, "knowledge.sources", { result: parsed.data });
        }
      }
    });

    try {
      await managed.session.prompt(message);
      if (managed.abortRequested) {
        stored.run.status = "aborted";
        stored.run.finishedAt = new Date().toISOString();
        this.emit(stored, "activity.completed", { activityId, outcome: "aborted" });
        this.emit(stored, "run.aborted", { status: "aborted", reason: "Stopped by user" });
        this.updateConversation(stored, "idle");
        return;
      }
      const finalText = managed.session.getLastAssistantText() ?? completedText;
      this.emit(stored, "activity.completed", { activityId, outcome: "completed" });
      this.emit(stored, "assistant.message.completed", {
        messageId: randomUUID(),
        text: finalText,
      });
      stored.run.status = "completed";
      stored.run.finishedAt = new Date().toISOString();
      this.emit(stored, "run.completed", { status: "completed" });
      this.updateConversation(stored, "idle");
    } catch (error) {
      const aborted = error instanceof Error && /abort/i.test(error.message);
      stored.run.status = aborted ? "aborted" : "failed";
      stored.run.finishedAt = new Date().toISOString();
      this.emit(stored, "activity.completed", {
        activityId,
        outcome: aborted ? "aborted" : "failed",
      });
      if (aborted) {
        this.emit(stored, "run.aborted", { status: "aborted", reason: "Stopped by user" });
        this.updateConversation(stored, "idle");
      } else {
        const errorMessage = error instanceof Error ? error.message : "Pi assistant failed";
        this.emit(stored, "run.failed", {
          status: "failed",
          code: "pi_failed",
          message: errorMessage,
        });
        this.updateConversation(stored, "failed");
      }
    } finally {
      unsubscribe();
      managed.activeRunId = null;
      managed.abortRequested = false;
    }
  }

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const managed = await this.getOrCreateSession(conversationId);
    return managed.session.messages.flatMap((message, index) => {
      if (message.role !== "user" && message.role !== "assistant") return [];
      const text = extractMessageText(message);
      if (!text) return [];
      return [{ messageId: `${conversationId}-${index}`, role: message.role, text }];
    });
  }

  async getRuntimeOptions(conversationId: string): Promise<RuntimeOptions> {
    const managed = await this.getOrCreateSession(conversationId);
    const modelRuntime = await this.modelRuntimePromise;
    const models = await modelRuntime.getAvailable();
    return {
      activeModel: managed.session.model
        ? `${managed.session.model.provider}/${managed.session.model.id}`
        : null,
      thinkingLevel: managed.session.thinkingLevel,
      models: models.map((model) => ({
        provider: model.provider,
        id: model.id,
        name: model.name,
        reasoning: model.reasoning,
      })),
      thinkingLevels: ["off", "minimal", "low", "medium", "high", "xhigh"],
    };
  }

  async updateRuntime(conversationId: string, update: UpdateRuntimeRequest): Promise<RuntimeOptions> {
    const managed = await this.getOrCreateSession(conversationId);
    if (managed.activeRunId) throw new Error("Cannot change runtime settings during an active run");
    if (update.model) {
      const modelRuntime = await this.modelRuntimePromise;
      const model = modelRuntime.getModel(update.model.provider, update.model.id);
      if (!model) throw new Error("Requested model is unavailable");
      await managed.session.setModel(model);
    }
    if (update.thinkingLevel) {
      managed.session.setThinkingLevel(
        update.thinkingLevel as Parameters<AgentSession["setThinkingLevel"]>[0],
      );
    }
    this.store.updateConversation(conversationId, {
      selectedModel: managed.session.model
        ? `${managed.session.model.provider}/${managed.session.model.id}`
        : null,
      thinkingLevel: managed.session.thinkingLevel,
    });
    return this.getRuntimeOptions(conversationId);
  }

  async abort(conversationId: string): Promise<void> {
    const managed = this.sessions.get(conversationId);
    if (managed?.activeRunId) {
      managed.abortRequested = true;
      await managed.session.abort();
    }
  }

  disposeConversation(conversationId: string): void {
    this.sessions.get(conversationId)?.session.dispose();
    this.sessions.delete(conversationId);
  }

  async dispose(): Promise<void> {
    for (const managed of this.sessions.values()) managed.session.dispose();
    this.sessions.clear();
    await this.engineeringMcp?.close();
  }

  private capabilities(): AssistantStatus["capabilities"] {
    return {
      tools: [...this.policy.allowedTools],
      externalAccess: this.policy.externalAccess,
      mutations: this.policy.mutations,
      scope: this.policy.scope,
    };
  }

  private async getOrCreateSession(conversationId: string): Promise<ManagedSession> {
    const existing = this.sessions.get(conversationId);
    if (existing) return existing;

    const existingPath = this.store.getSessionPath(conversationId);
    const sessionManager = existingPath
      ? SessionManager.open(existingPath)
      : SessionManager.create(this.cwd, this.sessionDirectory);
    const modelRuntime = await this.modelRuntimePromise;
    const customTools = this.engineeringMcp
      ? [...await this.engineeringMcp.createPiTools()]
      : [createKnowledgeTool()];
    const { session } = await createAgentSession({
      cwd: this.cwd,
      modelRuntime,
      noTools: "builtin",
      tools: [...this.policy.allowedTools],
      customTools,
      resourceLoader: createRestrictedResourceLoader(this.policy),
      sessionManager,
    });
    const conversation = this.store.conversations.get(conversationId);
    if (conversation?.selectedModel) {
      const [provider, ...modelIdParts] = conversation.selectedModel.split("/");
      const modelId = modelIdParts.join("/");
      const savedModel = provider && modelId ? modelRuntime.getModel(provider, modelId) : undefined;
      if (savedModel && (!session.model || session.model.provider !== provider || session.model.id !== modelId)) {
        await session.setModel(savedModel);
      }
    }
    if (conversation?.thinkingLevel && session.thinkingLevel !== conversation.thinkingLevel) {
      session.setThinkingLevel(conversation.thinkingLevel as Parameters<AgentSession["setThinkingLevel"]>[0]);
    }
    const managed: ManagedSession = { session, activeRunId: null, abortRequested: false };
    this.sessions.set(conversationId, managed);

    if (conversation) {
      const sessionPath = session.sessionFile;
      if (!sessionPath) throw new Error("Pi did not create a persistent session file");
      this.store.setSessionReference(
        conversationId,
        session.sessionManager.getSessionId(),
        sessionPath,
      );
      this.store.updateConversation(conversationId, {
        selectedModel: session.model ? `${session.model.provider}/${session.model.id}` : null,
        thinkingLevel: session.thinkingLevel,
      });
    }
    return managed;
  }

  private updateConversation(stored: StoredRun, status: "idle" | "failed"): void {
    const conversation = this.store.conversations.get(stored.run.conversationId);
    if (!conversation) return;
    conversation.status = status;
    conversation.updatedAt = stored.run.finishedAt ?? new Date().toISOString();
  }

  private emit<T extends StreamEvent["eventType"]>(
    stored: StoredRun,
    eventType: T,
    payload: Extract<StreamEvent, { eventType: T }>["payload"],
  ): void {
    const event = {
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      runId: stored.run.runId,
      conversationId: stored.run.conversationId,
      sequence: stored.run.lastSequence + 1,
      occurredAt: new Date().toISOString(),
      eventType,
      payload,
    } as Extract<StreamEvent, { eventType: T }>;
    this.store.appendEvent(stored.run.runId, event);
  }
}
