import { randomUUID } from "node:crypto";
import { CONTRACT_SCHEMA_VERSION, type AssistantStatus, type ConversationBranch, type RuntimeOptions, type StreamEvent } from "@simon/contracts";
import type { AssistantRuntime } from "./assistant-runtime.js";
import type { InMemoryStore, StoredRun } from "./store.js";

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class FakeAssistant implements AssistantRuntime {
  readonly name = "fake";

  constructor(
    private readonly store: InMemoryStore,
    private readonly stepDelayMs = 15,
  ) {}

  async getStatus(): Promise<AssistantStatus> {
    return {
      available: true,
      runtime: this.name,
      modelCount: 1,
      capabilities: {
        tools: [],
        externalAccess: false,
        mutations: false,
        scope: "Deterministic local test responses only",
      },
    };
  }

  async getBranches(_conversationId: string): Promise<ConversationBranch[]> {
    return [];
  }

  async selectBranch(_conversationId: string, _branchId: string): Promise<void> {
    throw new Error("The fake runtime does not persist alternate branches");
  }

  async editAndResend(stored: StoredRun, _userMessageIndex: number, message: string): Promise<void> {
    await this.execute(stored, message);
  }

  async regenerate(stored: StoredRun): Promise<void> {
    await this.execute(stored, "Regenerate the previous response");
  }

  async getMessages(): Promise<[]> {
    return [];
  }

  async getRuntimeOptions(): Promise<RuntimeOptions> {
    return {
      activeModel: "fake/deterministic",
      thinkingLevel: "off",
      models: [{ provider: "fake", id: "deterministic", name: "Deterministic fake", reasoning: false }],
      thinkingLevels: ["off"],
    };
  }

  async updateRuntime(): Promise<RuntimeOptions> {
    return this.getRuntimeOptions();
  }

  async execute(stored: StoredRun, message: string): Promise<void> {
    const { run } = stored;
    run.status = "running";
    this.emit(stored, "run.started", { status: "running" });

    const activityId = randomUUID();
    this.emit(stored, "activity.started", {
      activityId,
      label: "Preparing response",
      detail: "Using the deterministic development assistant",
    });

    const text = `Simon received: ${message}`;
    for (const token of text.split(/(\s+)/).filter(Boolean)) {
      await delay(this.stepDelayMs);
      this.emit(stored, "assistant.text.delta", { delta: token });
    }

    this.emit(stored, "activity.completed", { activityId, outcome: "completed" });
    this.emit(stored, "assistant.message.completed", { messageId: randomUUID(), text });
    run.status = "completed";
    run.finishedAt = new Date().toISOString();
    this.emit(stored, "run.completed", { status: "completed" });

    this.store.updateConversation(run.conversationId, { status: "idle" });
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
