import { describe, expect, it } from "vitest";

import type { EngineeringStatus, ProjectBinding } from "@simon/contracts";

import {
  EngineeringSnapshotService,
  SnapshotCollectionInterrupted,
  type EngineeringSnapshotCollector,
  type SnapshotBindingProvider,
  type SnapshotCollection,
} from "./engineering-snapshot.js";

const binding: ProjectBinding = {
  bindingId: "11111111-1111-4111-8111-111111111111",
  epoch: "22222222-2222-4222-8222-222222222222",
  processId: 42,
  processStartTime: "2026-01-01T00:00:00.000Z",
  projectName: "Qualified project",
  projectPathHash: "a".repeat(64),
  observedAt: "2026-01-01T00:00:01.000Z",
};

class BindingProvider implements SnapshotBindingProvider {
  status: EngineeringStatus = {
    mode: "tia-readonly",
    state: "connected",
    binding,
    conversationBindingMatches: true,
    observedAt: "2026-01-01T00:00:02.000Z",
  };

  getStatus(): EngineeringStatus {
    return this.status;
  }
}

const emptyForTest: SnapshotCollection = { documents: [], tagTables: [], references: [], coverage: [] };

const collection: SnapshotCollection = {
  documents: [{
    kind: "block",
    name: "Main",
    engineeringPath: "Program blocks/Main",
    parentPath: "Program blocks",
    language: "SCL",
    content: "FUNCTION Main",
    artifactId: null,
    attributes: { typeName: "FC" },
    sourceOperation: "tia.block.export",
    coverage: "complete",
  }],
  tagTables: [{
    name: "Default tags",
    engineeringPath: "PLC tags/Default tags",
    tags: [{
      name: "Ready",
      dataType: "Bool",
      logicalAddress: "%I0.0",
      comment: null,
      sourceOperation: "tia.tag.list",
      coverage: "complete",
    }],
    sourceOperation: "tia.tagTable.list",
    coverage: "complete",
  }],
  references: [{
    symbol: "Ready",
    sourcePath: "Program blocks/Main",
    targetPath: "PLC tags/Default tags/Ready",
    context: "read",
    sourceOperation: "tia.analysis.tagUsages",
    coverage: "complete",
  }],
  coverage: [{ capability: "snapshot.documents", state: "complete", observedCount: 1, note: "One document observed." }],
};

describe("EngineeringSnapshotService", () => {
  it("creates a conversation- and binding-scoped snapshot capture", async () => {
    const provider = new BindingProvider();
    const collector: EngineeringSnapshotCollector = { collect: async () => collection };
    const service = new EngineeringSnapshotService(
      provider,
      collector,
      undefined,
      () => new Date("2026-01-01T00:00:03.000Z"),
      () => "33333333-3333-4333-8333-333333333333",
    );

    const capture = await service.create("44444444-4444-4444-8444-444444444444", false, new AbortController().signal);

    expect(capture.snapshot).toMatchObject({
      snapshotId: "33333333-3333-4333-8333-333333333333",
      conversationId: "44444444-4444-4444-8444-444444444444",
      binding,
      state: "completed",
      freshness: "current",
      objectCount: 4,
      byteCount: 13,
      documentCount: 1,
    });
    expect(capture.records?.documents[0]).toMatchObject({
      engineeringPath: "Program blocks/Main",
      provenance: { bindingId: binding.bindingId, bindingEpoch: binding.epoch },
    });
    expect(service.getLatest(capture.snapshot.conversationId)).toEqual(capture);
  });

  it("persists running and terminal snapshot metadata through the repository seam", async () => {
    const provider = new BindingProvider();
    const savedStates: string[] = [];
    const service = new EngineeringSnapshotService(
      provider,
      { collect: async () => collection },
      undefined,
      undefined,
      undefined,
      { saveEngineeringSnapshot: (snapshot) => { savedStates.push(snapshot.state); return snapshot; } },
    );

    await service.create("12121212-1212-4212-8212-121212121212", false, new AbortController().signal);
    expect(savedStates).toEqual(["running", "completed"]);
  });

  it("publishes running state and records a failed terminal state", async () => {
    const provider = new BindingProvider();
    let rejectCollection: ((error: Error) => void) | undefined;
    const collector: EngineeringSnapshotCollector = {
      collect: () => new Promise((_resolve, reject) => { rejectCollection = reject; }),
    };
    const service = new EngineeringSnapshotService(provider, collector);
    const conversationId = "55555555-5555-4555-8555-555555555555";
    const creation = service.create(conversationId, false, new AbortController().signal);

    expect(service.getLatest(conversationId)?.snapshot.state).toBe("running");
    rejectCollection?.(new Error("read failed"));
    await expect(creation).rejects.toThrow("read failed");
    expect(service.getLatest(conversationId)?.snapshot).toMatchObject({ state: "failed", objectCount: 0 });
  });

  it("requires a current matching conversation binding", async () => {
    const provider = new BindingProvider();
    provider.status = { ...provider.status, state: "disconnected", conversationBindingMatches: false };
    const collector: EngineeringSnapshotCollector = { collect: async () => collection };
    const service = new EngineeringSnapshotService(provider, collector);

    await expect(service.create("66666666-6666-4666-8666-666666666666", false, new AbortController().signal))
      .rejects.toThrow(/current conversation-scoped engineering binding/);
  });

  it("reuses completed snapshots unless a refresh is forced", async () => {
    const provider = new BindingProvider();
    let calls = 0;
    const collector: EngineeringSnapshotCollector = { collect: async () => { calls += 1; return collection; } };
    const service = new EngineeringSnapshotService(provider, collector);
    const conversationId = "99999999-9999-4999-8999-999999999999";

    const first = await service.create(conversationId, false, new AbortController().signal);
    const reused = await service.create(conversationId, false, new AbortController().signal);
    const refreshed = await service.create(conversationId, true, new AbortController().signal);

    expect(reused).toBe(first);
    expect(refreshed.snapshot.snapshotId).not.toBe(first.snapshot.snapshotId);
    expect(calls).toBe(2);
  });

  it("retains interrupted observations and resumes the same snapshot", async () => {
    const provider = new BindingProvider();
    const partial: SnapshotCollection = { ...collection, references: [] };
    const requests: Parameters<EngineeringSnapshotCollector["collect"]>[0][] = [];
    const collector: EngineeringSnapshotCollector = {
      collect: async (request) => {
        requests.push(request);
        if (requests.length === 1) throw new SnapshotCollectionInterrupted(partial);
        return collection;
      },
    };
    const service = new EngineeringSnapshotService(
      provider,
      collector,
      undefined,
      undefined,
      () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    const conversationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    await expect(service.create(conversationId, false, new AbortController().signal)).rejects.toThrow(/interrupted/);
    expect(service.getLatest(conversationId)?.snapshot).toMatchObject({ state: "interrupted", objectCount: 3 });
    const resumed = await service.create(conversationId, false, new AbortController().signal);

    expect(requests[1]?.snapshotId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(requests[1]?.resumeFrom).toEqual(partial);
    expect(resumed.snapshot).toMatchObject({ snapshotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", state: "completed" });
  });

  it("records bounded partial snapshots when object or byte limits are exceeded", async () => {
    const provider = new BindingProvider();
    const collector: EngineeringSnapshotCollector = { collect: async () => collection };
    const conversationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const objectLimited = new EngineeringSnapshotService(provider, collector, {
      maxObjects: 3, maxBytes: 100, maxDurationMs: 1_000, maxResultsPerQuery: 5,
    });

    await expect(objectLimited.create(conversationId, false, new AbortController().signal)).rejects.toThrow(/object limit/);
    expect(objectLimited.getLatest(conversationId)?.snapshot).toMatchObject({ state: "partial", objectCount: 4 });

    const byteLimited = new EngineeringSnapshotService(provider, collector, {
      maxObjects: 10, maxBytes: 12, maxDurationMs: 1_000, maxResultsPerQuery: 5,
    });
    await expect(byteLimited.create(conversationId, true, new AbortController().signal)).rejects.toThrow(/byte limit/);
    expect(byteLimited.getLatest(conversationId)?.snapshot).toMatchObject({ state: "partial", byteCount: 13 });
  });

  it("enforces duration and per-conversation concurrency limits", async () => {
    const provider = new BindingProvider();
    let release: (() => void) | undefined;
    const collector: EngineeringSnapshotCollector = {
      collect: (request) => new Promise((resolve, reject) => {
        release = () => resolve(collection);
        request.signal.addEventListener("abort", () => reject(new SnapshotCollectionInterrupted(emptyForTest)), { once: true });
      }),
    };
    const service = new EngineeringSnapshotService(provider, collector, {
      maxObjects: 10, maxBytes: 100, maxDurationMs: 20, maxResultsPerQuery: 7,
    });
    const conversationId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const running = service.create(conversationId, false, new AbortController().signal);
    await expect(service.create(conversationId, false, new AbortController().signal)).rejects.toThrow(/already running/);
    await expect(running).rejects.toThrow(/interrupted/);
    expect(service.getLatest(conversationId)?.snapshot.state).toBe("interrupted");
    release?.();
  });

  it("passes result limits to the collector", async () => {
    const provider = new BindingProvider();
    let observedLimit = 0;
    const collector: EngineeringSnapshotCollector = {
      collect: async (request) => { observedLimit = request.limits.maxResultsPerQuery; return collection; },
    };
    const service = new EngineeringSnapshotService(provider, collector, {
      maxObjects: 10, maxBytes: 100, maxDurationMs: 1_000, maxResultsPerQuery: 9,
    });
    await service.create("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", false, new AbortController().signal);
    expect(observedLimit).toBe(9);
  });

  it("fails closed when the binding changes during collection", async () => {
    const provider = new BindingProvider();
    const collector: EngineeringSnapshotCollector = {
      collect: async () => {
        provider.status = { ...provider.status, binding: { ...binding, epoch: "77777777-7777-4777-8777-777777777777" } };
        return collection;
      },
    };
    const service = new EngineeringSnapshotService(provider, collector);
    const conversationId = "88888888-8888-4888-8888-888888888888";

    await expect(service.create(conversationId, false, new AbortController().signal)).rejects.toThrow(/binding changed/);
    expect(service.getLatest(conversationId)?.snapshot.state).toBe("failed");
  });
});
