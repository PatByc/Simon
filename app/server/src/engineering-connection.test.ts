import { describe, expect, it, vi } from "vitest";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { TObject } from "typebox";
import { EngineeringConnectionManager } from "./engineering-connection.js";
import type { EngineeringMcpGateway } from "./engineering-mcp-client.js";
import { getRuntimePolicy } from "./runtime-policy.js";
import { InMemoryStore } from "./store.js";

const processStartTime = "2026-11-09T10:00:00.000Z";

class FakeEngineeringGateway implements EngineeringMcpGateway {
  onExecutionError: ((error: unknown) => void) | null = null;
  readonly attach = vi.fn(async (_processId: number) => undefined);
  readonly detach = vi.fn(async () => undefined);
  readonly close = vi.fn(async () => undefined);
  readonly listProcesses = vi.fn(async () => [{
    processId: 42,
    processStartTime,
    acquisitionTime: "2026-11-09T10:05:00.000Z",
    hasProject: true,
  }]);
  readonly getState = vi.fn(async () => ({ connected: true, projectName: "Plant" }));
  readonly getOpenProjects = vi.fn(async () => [{ name: "Plant", path: "C:/Projects/Plant.ap20" }]);
  readonly getProjectTree = vi.fn(async () => "Plant\n└── PLC_1");
  readonly callSnapshotTool = vi.fn(async () => ({}));
  readonly extractSource = vi.fn(async () => ({ kind: "block-xml" as const, engineeringPath: "Program blocks/Main", artifacts: [], totalBytes: 0 }));
  readonly readArtifact = vi.fn(async () => new Uint8Array());

  async createPiTools(
    beforeExecute: () => Promise<void>,
    onExecutionError: (error: unknown) => void,
  ): Promise<readonly ToolDefinition<TObject>[]> {
    this.onExecutionError = onExecutionError;
    return [{
      name: "simon_tia_get_state",
      label: "Get state",
      description: "test",
      parameters: {} as TObject,
      execute: async () => {
        await beforeExecute();
        return { content: [{ type: "text", text: "ok" }], details: {} };
      },
    }];
  }
}

function createManager() {
  const store = new InMemoryStore();
  const conversation = store.createConversation({ title: "Engineering", approvalMode: "manual" });
  const gateway = new FakeEngineeringGateway();
  const manager = new EngineeringConnectionManager(
    store,
    getRuntimePolicy({ SIMON_ENGINEERING_MODE: "tia-readonly" }),
    gateway,
  );
  return { store, conversation, gateway, manager };
}

describe("EngineeringConnectionManager", () => {
  it("reports discovery failures truthfully", async () => {
    const { gateway, manager } = createManager();
    gateway.listProcesses.mockRejectedValueOnce(new Error("Openness unavailable"));

    await expect(manager.listProcesses()).rejects.toThrow("Openness unavailable");
    expect(manager.getStatus()).toMatchObject({ state: "failed", reason: "Openness unavailable" });
  });

  it("requires an exact process-start identity before attachment", async () => {
    const { conversation, gateway, manager } = createManager();

    await expect(manager.attach(conversation.conversationId, {
      processId: 42,
      processStartTime: "2026-11-09T11:00:00.000Z",
    })).rejects.toThrow("changed or exited");
    expect(gateway.attach).not.toHaveBeenCalled();
  });

  it("binds a conversation and returns bounded inventory", async () => {
    const { conversation, manager, store } = createManager();
    const binding = await manager.attach(conversation.conversationId, { processId: 42, processStartTime });

    expect(binding.projectName).toBe("Plant");
    expect(binding.projectPathHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(binding)).not.toContain("C:/Projects/Plant.ap20");
    expect(store.conversations.get(conversation.conversationId)?.projectBinding).toEqual(binding);
    expect(manager.getStatus(conversation.conversationId)).toMatchObject({
      state: "connected",
      conversationBindingMatches: true,
    });
    await expect(manager.getInventory(conversation.conversationId)).resolves.toMatchObject({
      binding,
      partial: true,
      projectTree: expect.stringContaining("PLC_1"),
      coverage: expect.arrayContaining([expect.stringContaining("outside M1 coverage")]),
    });
    const capabilities = manager.getCapabilities().capabilities;
    expect(capabilities.filter((capability) => capability.available)).toHaveLength(23);
    expect(capabilities.filter((capability) => capability.status === "live-tested")).toHaveLength(17);
    expect(capabilities.filter((capability) => capability.status === "partial")).toHaveLength(6);
    expect(capabilities.find((capability) => capability.capability === "simon_engineering_search")).toMatchObject({
      label: "Search",
      status: "live-tested",
    });
    expect(capabilities.find((capability) => capability.capability === "tia.project.mutation")).toMatchObject({
      status: "disabled",
      available: false,
    });
  });

  it("invalidates prior snapshots when reconnection advances the binding epoch", async () => {
    const { conversation, manager, store } = createManager();
    const firstBinding = await manager.attach(conversation.conversationId, { processId: 42, processStartTime });
    const snapshotId = "c07f4af7-95a5-467c-89f5-ded7bc703b62";
    store.saveEngineeringSnapshot({
      snapshotId,
      conversationId: conversation.conversationId,
      binding: firstBinding,
      state: "completed",
      freshness: "current",
      staleReason: null,
      createdAt: "2026-11-09T10:10:00.000Z",
      updatedAt: "2026-11-09T10:10:01.000Z",
      completedAt: "2026-11-09T10:10:01.000Z",
      objectCount: 0,
      byteCount: 0,
      documentCount: 0,
      limits: { maxObjects: 10, maxBytes: 100, maxDurationMs: 1000, maxResultsPerQuery: 5 },
      coverage: [],
    });

    const secondBinding = await manager.attach(conversation.conversationId, { processId: 42, processStartTime });

    expect(secondBinding.bindingId).toBe(firstBinding.bindingId);
    expect(secondBinding.epoch).not.toBe(firstBinding.epoch);
    expect(store.getEngineeringSnapshot(snapshotId)).toMatchObject({ state: "stale", freshness: "stale" });
  });

  it("does not allow a bound conversation to switch targets", async () => {
    const { conversation, manager } = createManager();
    await manager.attach(conversation.conversationId, { processId: 42, processStartTime });

    await expect(manager.attach(conversation.conversationId, {
      processId: 99,
      processStartTime,
    })).rejects.toThrow("already bound to another engineering target");
  });

  it("blocks Pi tools for an unbound conversation", async () => {
    const { conversation, manager } = createManager();
    const [tool] = await manager.createPiTools(conversation.conversationId);

    await expect(tool?.execute("call-1", {}, undefined, undefined, {} as never)).rejects.toThrow("Connect this conversation");
  });

  it("invalidates snapshots when a read detects a project mismatch", async () => {
    const { conversation, gateway, manager, store } = createManager();
    const binding = await manager.attach(conversation.conversationId, { processId: 42, processStartTime });
    const snapshotId = "d07f4af7-95a5-467c-89f5-ded7bc703b62";
    store.saveEngineeringSnapshot({
      snapshotId,
      conversationId: conversation.conversationId,
      binding,
      state: "completed",
      freshness: "current",
      staleReason: null,
      createdAt: "2026-11-09T10:10:00.000Z",
      updatedAt: "2026-11-09T10:10:01.000Z",
      completedAt: "2026-11-09T10:10:01.000Z",
      objectCount: 0,
      byteCount: 0,
      documentCount: 0,
      limits: { maxObjects: 10, maxBytes: 100, maxDurationMs: 1000, maxResultsPerQuery: 5 },
      coverage: [],
    });
    await manager.createPiTools(conversation.conversationId);

    gateway.onExecutionError?.(new Error("The active TIA project changed; rebind before continuing."));

    expect(manager.getStatus(conversation.conversationId).state).toBe("stale");
    expect(store.getEngineeringSnapshot(snapshotId)).toMatchObject({ state: "stale", freshness: "stale" });
  });

  it("blocks Pi tools when the conversation epoch becomes stale", async () => {
    const { conversation, manager, store } = createManager();
    const binding = await manager.attach(conversation.conversationId, { processId: 42, processStartTime });
    const [tool] = await manager.createPiTools(conversation.conversationId);
    store.updateConversation(conversation.conversationId, {
      projectBinding: { ...binding, epoch: "e9ee766f-42de-4ca6-9eb8-a01d07ae41dc" },
    });

    await expect(tool?.execute("call-1", {}, undefined, undefined, {} as never)).rejects.toThrow("stale");
  });

  it("blocks Pi tools and invalidates snapshots after detach until explicit reconnection", async () => {
    const { conversation, manager, store } = createManager();
    const binding = await manager.attach(conversation.conversationId, { processId: 42, processStartTime });
    const snapshotId = "b07f4af7-95a5-467c-89f5-ded7bc703b62";
    store.saveEngineeringSnapshot({
      snapshotId,
      conversationId: conversation.conversationId,
      binding,
      state: "completed",
      freshness: "current",
      staleReason: null,
      createdAt: "2026-11-09T10:10:00.000Z",
      updatedAt: "2026-11-09T10:10:01.000Z",
      completedAt: "2026-11-09T10:10:01.000Z",
      objectCount: 0,
      byteCount: 0,
      documentCount: 0,
      limits: { maxObjects: 10, maxBytes: 100, maxDurationMs: 1000, maxResultsPerQuery: 5 },
      coverage: [],
    });
    const [tool] = await manager.createPiTools(conversation.conversationId);
    await manager.detach();

    await expect(tool?.execute("call-1", {}, undefined, undefined, {} as never)).rejects.toThrow("disconnected");
    expect(store.getEngineeringSnapshot(snapshotId)).toMatchObject({
      state: "stale",
      freshness: "stale",
      staleReason: expect.stringMatching(/detached/),
    });
  });
});
