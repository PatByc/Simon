import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";
import type { EngineeringConnection } from "./engineering-connection.js";
import { FakeAssistant } from "./fake-assistant.js";
import { InMemoryStore } from "./store.js";

const apps: ReturnType<typeof buildApp>[] = [];
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function createTestApp() {
  const store = new InMemoryStore();
  const app = buildApp({ store, assistant: new FakeAssistant(store, 0) });
  apps.push(app);
  return { app, store };
}

describe("Simon API", () => {
  it("reports the fake runtime as available", async () => {
    const { app } = createTestApp();
    const response = await app.inject({ method: "GET", url: "/api/v1/status" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      available: true,
      runtime: "fake",
      modelCount: 1,
      capabilities: {
        tools: [],
        externalAccess: false,
        mutations: false,
        scope: "Deterministic local test responses only",
      },
    });
  });

  it("keeps engineering lifecycle operations behind host-controlled endpoints", async () => {
    const store = new InMemoryStore();
    const binding = {
      bindingId: "d07f4af7-95a5-467c-89f5-ded7bc703b62",
      epoch: "5df7d2e5-1c72-4aaf-b98a-cf8525538950",
      processId: 42,
      processStartTime: "2026-11-09T09:00:00.000Z",
      projectName: "Plant",
      projectPathHash: "a".repeat(64),
      observedAt: "2026-11-09T10:00:00.000Z",
    };
    const engineering: EngineeringConnection = {
      getStatus: () => ({
        mode: "tia-readonly",
        state: "disconnected",
        binding: null,
        conversationBindingMatches: false,
        observedAt: "2026-11-09T10:00:00.000Z",
      }),
      listProcesses: vi.fn(async () => ({
        processes: [{
          processId: 42,
          processStartTime: binding.processStartTime,
          acquisitionTime: "2026-11-09T10:00:00.000Z",
          hasProject: true,
        }],
        observedAt: "2026-11-09T10:00:00.000Z",
      })),
      attach: vi.fn(async () => binding),
      detach: vi.fn(async () => undefined),
      getCapabilities: () => ({ capabilities: [], observedAt: "2026-11-09T10:00:00.000Z" }),
      getDiagnostics: () => ({
        mode: "tia-readonly",
        piIntegration: "sdk",
        piPackageVersion: "1.5.0",
        mcpPackageVersion: "0.1.0",
        connector: "tia-v20",
        tiaMajorVersion: 20,
        workerAvailable: true,
        modelToolCount: 18,
        hostToolCount: 3,
        processCount: 1,
        activeBinding: null,
        warnings: [],
        observedAt: "2026-11-09T10:00:00.000Z",
      }),
      getInventory: vi.fn(async () => ({
        binding,
        observedAt: "2026-11-09T10:00:00.000Z",
        projectTree: "Plant",
        partial: true,
        coverage: ["Bounded"],
      })),
      createPiTools: vi.fn(async () => []),
      close: vi.fn(async () => undefined),
    };
    const app = buildApp({ store, assistant: new FakeAssistant(store, 0), engineering });
    apps.push(app);
    const created = await app.inject({ method: "POST", url: "/api/v1/conversations", payload: {} });
    const conversationId = created.json().conversationId as string;

    expect((await app.inject({ method: "GET", url: "/api/v1/engineering/processes" })).statusCode).toBe(200);
    const attached = await app.inject({
      method: "POST",
      url: `/api/v1/conversations/${conversationId}/engineering-binding`,
      payload: { processId: 42, processStartTime: binding.processStartTime },
    });
    expect(attached.statusCode).toBe(201);
    expect(attached.json()).toEqual(binding);
    expect((await app.inject({ method: "DELETE", url: "/api/v1/engineering/connection" })).statusCode).toBe(204);
  });

  it("creates a conversation with manual approval by default", async () => {
    const { app } = createTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/conversations",
      payload: { title: "Test conversation" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      title: "Test conversation",
      approvalMode: "manual",
      status: "idle",
    });
  });

  it("renames, lists, restores, and deletes conversation metadata", async () => {
    const { app } = createTestApp();
    const created = await app.inject({ method: "POST", url: "/api/v1/conversations", payload: {} });
    const conversationId = created.json().conversationId as string;

    const renamed = await app.inject({
      method: "PATCH",
      url: `/api/v1/conversations/${conversationId}`,
      payload: { title: "Renamed conversation" },
    });
    expect(renamed.json().title).toBe("Renamed conversation");

    const messages = await app.inject({
      method: "GET",
      url: `/api/v1/conversations/${conversationId}/messages`,
    });
    expect(messages.json()).toEqual({ messages: [] });

    const listed = await app.inject({ method: "GET", url: "/api/v1/conversations" });
    expect(listed.json().conversations).toHaveLength(1);

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/v1/conversations/${conversationId}`,
    });
    expect(deleted.statusCode).toBe(204);
  });

  it("searches conversation titles through the local transcript index", async () => {
    const directory = mkdtempSync(join(tmpdir(), "simon-app-search-"));
    temporaryDirectories.push(directory);
    const store = new InMemoryStore(join(directory, "simon.sqlite"));
    const app = buildApp({ store, assistant: new FakeAssistant(store, 0) });
    apps.push(app);
    await app.inject({ method: "POST", url: "/api/v1/conversations", payload: { title: "Pump restart analysis" } });

    const response = await app.inject({ method: "GET", url: "/api/v1/conversations/search?q=restart" });
    expect(response.statusCode).toBe(200);
    expect(response.json().results[0].conversation.title).toBe("Pump restart analysis");
    expect(response.json().results[0].matchedRole).toBe("title");
  });

  it("returns the runtime branch list for a conversation", async () => {
    const { app } = createTestApp();
    const created = await app.inject({ method: "POST", url: "/api/v1/conversations", payload: {} });
    const conversationId = created.json().conversationId as string;

    const response = await app.inject({ method: "GET", url: `/api/v1/conversations/${conversationId}/branches` });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ branches: [] });
  });

  it("starts an edited-message branch run", async () => {
    const { app } = createTestApp();
    const created = await app.inject({ method: "POST", url: "/api/v1/conversations", payload: {} });
    const conversationId = created.json().conversationId as string;

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/conversations/${conversationId}/edit-and-resend`,
      payload: { userMessageIndex: 0, message: "Edited prompt" },
    });
    expect(response.statusCode).toBe(202);
    expect(response.json().runId).toBeTypeOf("string");
  });

  it("starts a response regeneration run on an existing conversation", async () => {
    const { app } = createTestApp();
    const created = await app.inject({ method: "POST", url: "/api/v1/conversations", payload: {} });
    const conversationId = created.json().conversationId as string;

    const response = await app.inject({ method: "POST", url: `/api/v1/conversations/${conversationId}/regenerate` });
    expect(response.statusCode).toBe(202);
    expect(response.json().runId).toBeTypeOf("string");
  });

  it("deletes all saved conversations through the privacy endpoint", async () => {
    const { app } = createTestApp();
    await app.inject({ method: "POST", url: "/api/v1/conversations", payload: {} });
    await app.inject({ method: "POST", url: "/api/v1/conversations", payload: {} });

    const deleted = await app.inject({ method: "DELETE", url: "/api/v1/conversations" });
    expect(deleted.statusCode).toBe(204);

    const listed = await app.inject({ method: "GET", url: "/api/v1/conversations" });
    expect(listed.json()).toEqual({ conversations: [] });
  });

  it("returns and updates runtime options through the assistant adapter", async () => {
    const { app } = createTestApp();
    const created = await app.inject({ method: "POST", url: "/api/v1/conversations", payload: {} });
    const conversationId = created.json().conversationId as string;

    const options = await app.inject({
      method: "GET",
      url: `/api/v1/conversations/${conversationId}/runtime`,
    });
    expect(options.json()).toMatchObject({ activeModel: "fake/deterministic", thinkingLevel: "off" });

    const updated = await app.inject({
      method: "PATCH",
      url: `/api/v1/conversations/${conversationId}/runtime`,
      payload: { thinkingLevel: "off" },
    });
    expect(updated.statusCode).toBe(200);
  });

  it("runs the fake assistant and stores ordered terminal events", async () => {
    const { app, store } = createTestApp();
    const conversationResponse = await app.inject({
      method: "POST",
      url: "/api/v1/conversations",
      payload: {},
    });
    const conversationId = conversationResponse.json().conversationId as string;

    const runResponse = await app.inject({
      method: "POST",
      url: `/api/v1/conversations/${conversationId}/runs`,
      payload: { message: "Hello" },
    });

    expect(runResponse.statusCode).toBe(202);
    const runId = runResponse.json().runId as string;

    await vi.waitFor(() => expect(store.runs.get(runId)?.run.status).toBe("completed"));
    const stored = store.runs.get(runId);
    expect(stored?.events.map((event) => event.sequence)).toEqual(
      stored?.events.map((_, index) => index + 1),
    );
    expect(stored?.events.at(0)?.eventType).toBe("run.started");
    expect(stored?.events.at(-1)?.eventType).toBe("run.completed");
  });

  it("rejects a second run while a conversation is busy", async () => {
    const store = new InMemoryStore();
    const app = buildApp({ store, assistant: new FakeAssistant(store, 100) });
    apps.push(app);
    const conversationResponse = await app.inject({
      method: "POST",
      url: "/api/v1/conversations",
      payload: {},
    });
    const conversationId = conversationResponse.json().conversationId as string;

    await app.inject({
      method: "POST",
      url: `/api/v1/conversations/${conversationId}/runs`,
      payload: { message: "First" },
    });
    const second = await app.inject({
      method: "POST",
      url: `/api/v1/conversations/${conversationId}/runs`,
      payload: { message: "Second" },
    });

    expect(second.statusCode).toBe(409);
    expect(second.json().code).toBe("conversation_busy");
  });
});
