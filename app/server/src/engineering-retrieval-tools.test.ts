import { describe, expect, it } from "vitest";

import type { EngineeringStatus, ProjectBinding } from "@simon/contracts";

import { EngineeringRetrievalService } from "./engineering-retrieval.js";
import {
  ENGINEERING_REFERENCES_TOOL,
  ENGINEERING_SEARCH_TOOL,
  ENGINEERING_SNAPSHOT_STATUS_TOOL,
  EngineeringRetrievalToolProvider,
} from "./engineering-retrieval-tools.js";
import {
  EngineeringSnapshotService,
  type SnapshotBindingProvider,
  type SnapshotCollection,
} from "./engineering-snapshot.js";
import { InMemoryStore } from "./store.js";

const binding: ProjectBinding = {
  bindingId: "11111111-1111-4111-8111-111111111111",
  epoch: "22222222-2222-4222-8222-222222222222",
  processId: 42,
  processStartTime: "2026-01-01T00:00:00.000Z",
  projectName: "Plant",
  projectPathHash: "a".repeat(64),
  observedAt: "2026-01-01T00:00:01.000Z",
};

class Provider implements SnapshotBindingProvider {
  status: EngineeringStatus = {
    mode: "tia-readonly",
    state: "connected",
    binding,
    conversationBindingMatches: true,
    observedAt: "2026-01-01T00:00:02.000Z",
  };
  getStatus(): EngineeringStatus { return this.status; }
}

const collection: SnapshotCollection = {
  documents: [{
    kind: "block",
    name: "Main",
    engineeringPath: "Program blocks/Main",
    parentPath: "Program blocks",
    language: "SCL",
    content: "FUNCTION Main",
    artifactId: null,
    attributes: { constantName: "FC_Main" },
    sourceOperation: "tia.block.export",
    coverage: "complete",
  }],
  tagTables: [],
  references: [{
    symbol: "Ready",
    sourcePath: "Program blocks/Main",
    targetPath: "PLC tags/Inputs/Ready",
    context: "read",
    sourceOperation: "tia.analysis.tagUsages",
    coverage: "complete",
  }],
  coverage: [{ capability: "snapshot.documents", state: "complete", observedCount: 1, note: "Observed." }],
};

async function harness() {
  const conversationId = "33333333-3333-4333-8333-333333333333";
  const engineering = new Provider();
  const store = new InMemoryStore();
  const snapshots = new EngineeringSnapshotService(
    engineering,
    { collect: async () => collection },
    undefined,
    () => new Date("2026-01-01T00:00:03.000Z"),
    () => "44444444-4444-4444-8444-444444444444",
    store,
  );
  await snapshots.create(conversationId, false, new AbortController().signal);
  const provider = new EngineeringRetrievalToolProvider(engineering, snapshots, new EngineeringRetrievalService(), store);
  return { conversationId, engineering, store, tools: provider.createPiTools(conversationId) };
}

function toolByName(tools: Awaited<ReturnType<typeof harness>>["tools"], name: string) {
  const tool = tools.find((item) => item.name === name);
  if (!tool) throw new Error(`Missing tool ${name}`);
  return tool;
}

describe("EngineeringRetrievalToolProvider", () => {
  it("exposes only status, search, and exact-reference snapshot tools", async () => {
    const { tools } = await harness();
    expect(tools.map((tool) => tool.name)).toEqual([
      ENGINEERING_SNAPSHOT_STATUS_TOOL,
      ENGINEERING_SEARCH_TOOL,
      ENGINEERING_REFERENCES_TOOL,
    ]);
    expect(tools.every((tool) => !/refresh|attach|export/i.test(tool.name))).toBe(true);
  });

  it("returns current snapshot status and cited exact search results", async () => {
    const { tools } = await harness();
    const status = await toolByName(tools, ENGINEERING_SNAPSHOT_STATUS_TOOL).execute("call-1", {}, undefined, undefined, {} as never);
    expect(status.details).toMatchObject({ engineeringSnapshotStatus: { snapshot: { state: "completed", freshness: "current" } } });

    const search = await toolByName(tools, ENGINEERING_SEARCH_TOOL).execute(
      "call-2",
      { query: "FC_Main" },
      undefined,
      undefined,
      {} as never,
    );
    expect(search.details).toMatchObject({
      engineeringSearchResult: {
        hits: [{ matchKind: "identifier", citation: { engineeringPath: "Program blocks/Main", freshness: "current" } }],
      },
    });
  });

  it("returns bounded exact references with source-linked citations", async () => {
    const { tools } = await harness();
    const result = await toolByName(tools, ENGINEERING_REFERENCES_TOOL).execute(
      "call-3",
      { symbol: "Ready", limit: 5 },
      undefined,
      undefined,
      {} as never,
    );
    expect(result.details).toMatchObject({
      engineeringReferenceResult: {
        references: [{ sourcePath: "Program blocks/Main", citation: { engineeringPath: "Program blocks/Main" } }],
      },
    });
  });

  it("fails every retrieval tool closed for detached bindings", async () => {
    const { tools, engineering } = await harness();
    engineering.status = { ...engineering.status, state: "disconnected", conversationBindingMatches: false };

    await expect(toolByName(tools, ENGINEERING_SNAPSHOT_STATUS_TOOL).execute(
      "call-4", {}, undefined, undefined, {} as never,
    )).rejects.toThrow(/current conversation-scoped/);
    await expect(toolByName(tools, ENGINEERING_SEARCH_TOOL).execute(
      "call-5", { query: "Main" }, undefined, undefined, {} as never,
    )).rejects.toThrow(/current conversation-scoped/);
    await expect(toolByName(tools, ENGINEERING_REFERENCES_TOOL).execute(
      "call-6", { symbol: "Ready" }, undefined, undefined, {} as never,
    )).rejects.toThrow(/current conversation-scoped/);
  });

  it("rejects stale snapshots and binding-epoch mismatches", async () => {
    const stale = await harness();
    stale.store.markEngineeringSnapshotsStale({}, "Detached.");
    await expect(toolByName(stale.tools, ENGINEERING_SEARCH_TOOL).execute(
      "call-7", { query: "Main" }, undefined, undefined, {} as never,
    )).rejects.toThrow(/stale or incomplete/);

    const mismatched = await harness();
    mismatched.engineering.status = {
      ...mismatched.engineering.status,
      binding: { ...binding, epoch: "55555555-5555-4555-8555-555555555555" },
    };
    await expect(toolByName(mismatched.tools, ENGINEERING_SEARCH_TOOL).execute(
      "call-8", { query: "Main" }, undefined, undefined, {} as never,
    )).rejects.toThrow(/does not match/);
    await expect(toolByName(mismatched.tools, ENGINEERING_REFERENCES_TOOL).execute(
      "call-9", { symbol: "Ready" }, undefined, undefined, {} as never,
    )).rejects.toThrow(/does not match/);
  });
});
