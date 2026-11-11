import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { SourceExtractionRequest } from "@simon/mcp";
import type { TObject } from "typebox";

import { buildApp } from "./app.js";
import { EngineeringConnectionManager } from "./engineering-connection.js";
import type { EngineeringMcpGateway } from "./engineering-mcp-client.js";
import { EngineeringRetrievalService } from "./engineering-retrieval.js";
import { EngineeringSnapshotService } from "./engineering-snapshot.js";
import { FakeAssistant } from "./fake-assistant.js";
import { getRuntimePolicy } from "./runtime-policy.js";
import { InMemoryStore } from "./store.js";
import { fixtureCollection } from "./testing/engineering-fixture.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

class Gateway implements EngineeringMcpGateway {
  readonly detach = vi.fn(async () => undefined);
  readonly close = vi.fn(async () => undefined);
  async listProcesses() { return [{ processId: 42, processStartTime: "2026-01-01T00:00:00.000Z", acquisitionTime: "2026-01-01T00:00:01.000Z", hasProject: true }]; }
  async attach() {}
  async getState() { return { connected: true, projectName: "Synthetic Qualification Project" }; }
  async getOpenProjects() { return [{ name: "Synthetic Qualification Project", path: "C:/synthetic/project.ap20" }]; }
  async getProjectTree() { return "Synthetic Qualification Project"; }
  async callSnapshotTool() { return {}; }
  async extractSource(request: SourceExtractionRequest) { return { kind: request.kind, engineeringPath: request.engineeringPath, artifacts: [], totalBytes: 0 }; }
  async readArtifact() { return new Uint8Array(); }
  async createPiTools(): Promise<readonly ToolDefinition<TObject>[]> { return []; }
}

describe("M2 application integration", () => {
  it("refreshes, persists, retrieves, cites, detaches, and restores stale snapshots", async () => {
    const root = mkdtempSync(join(tmpdir(), "simon-m2-integration-"));
    roots.push(root);
    const databasePath = join(root, "simon.sqlite");
    const store = new InMemoryStore(databasePath);
    const conversation = store.createConversation({ title: "M2 integration", approvalMode: "manual" });
    const engineering = new EngineeringConnectionManager(
      store,
      getRuntimePolicy({ SIMON_ENGINEERING_MODE: "tia-readonly" }),
      new Gateway(),
    );
    await engineering.attach(conversation.conversationId, { processId: 42, processStartTime: "2026-01-01T00:00:00.000Z" });
    const snapshots = new EngineeringSnapshotService(
      engineering,
      { collect: async () => fixtureCollection },
      undefined,
      undefined,
      undefined,
      store,
    );
    const app = buildApp({
      store,
      assistant: new FakeAssistant(store, 0),
      engineering,
      snapshots,
      engineeringRetrieval: new EngineeringRetrievalService(),
    });

    const refresh = await app.inject({ method: "POST", url: `/api/v1/conversations/${conversation.conversationId}/engineering-snapshot`, payload: {} });
    expect(refresh.statusCode).toBe(201);
    expect(refresh.json()).toMatchObject({ state: "partial", freshness: "current" });

    const exact = await app.inject({ method: "POST", url: `/api/v1/conversations/${conversation.conversationId}/engineering-search`, payload: { query: "%Q0.0" } });
    expect(exact.json()).toMatchObject({ hits: [{ matchKind: "logical-address", citation: { freshness: "current" } }] });

    const ambiguous = await app.inject({ method: "POST", url: `/api/v1/conversations/${conversation.conversationId}/engineering-search`, payload: { query: "Pump" } });
    expect(ambiguous.statusCode).toBe(409);
    expect(ambiguous.json()).toMatchObject({ code: "engineering_query_ambiguous" });

    const lexical = await app.inject({ method: "POST", url: `/api/v1/conversations/${conversation.conversationId}/engineering-search`, payload: { query: "restart delay" } });
    expect(lexical.json()).toMatchObject({ hits: [{ matchKind: "lexical", citation: { engineeringPath: "Program blocks/Main" } }] });

    const references = await app.inject({ method: "GET", url: `/api/v1/conversations/${conversation.conversationId}/engineering-references?symbol=Ready` });
    expect(references.json()).toMatchObject({ references: [{ citation: { engineeringPath: "Program blocks/Main" } }] });

    expect((await app.inject({ method: "DELETE", url: "/api/v1/engineering/connection" })).statusCode).toBe(204);
    const detachedSearch = await app.inject({ method: "POST", url: `/api/v1/conversations/${conversation.conversationId}/engineering-search`, payload: { query: "Main" } });
    expect(detachedSearch.statusCode).toBe(409);
    expect(store.getLatestEngineeringSnapshot(conversation.conversationId)).toMatchObject({ state: "stale", freshness: "stale" });

    await app.close();
    const restored = new InMemoryStore(databasePath);
    expect(restored.getLatestEngineeringSnapshot(conversation.conversationId)).toMatchObject({ state: "stale", freshness: "stale" });
    restored.close();
  });
});
