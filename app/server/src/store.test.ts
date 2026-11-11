import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import type { EngineeringSnapshot } from "@simon/contracts";
import { normalizeEngineeringRecords } from "./engineering-normalization.js";
import type { SnapshotCollection } from "./engineering-snapshot.js";
import { InMemoryStore } from "./store.js";

const temporaryDirectories: string[] = [];

const searchableCollection: SnapshotCollection = {
  documents: [{
    kind: "block",
    name: "RestartControl",
    engineeringPath: "Program blocks/RestartControl",
    parentPath: "Program blocks",
    language: "SCL",
    content: "The motor restart delay is five seconds.",
    artifactId: null,
    attributes: { constantName: "FC_RestartControl" },
    sourceOperation: "tia.block.export",
    coverage: "complete",
  }],
  tagTables: [{
    name: "Inputs",
    engineeringPath: "PLC tags/Inputs",
    tags: [{ name: "MotorReady", dataType: "Bool", logicalAddress: "%I0.0", comment: "Motor permissive", sourceOperation: "tia.tag.list", coverage: "complete" }],
    sourceOperation: "tia.tagTable.list",
    coverage: "complete",
  }],
  references: [],
  coverage: [],
};

function createSnapshot(conversationId: string): EngineeringSnapshot {
  return {
    snapshotId: "11111111-1111-4111-8111-111111111111",
    conversationId,
    binding: {
      bindingId: "22222222-2222-4222-8222-222222222222",
      epoch: "33333333-3333-4333-8333-333333333333",
      processId: 42,
      processStartTime: "2026-01-01T00:00:00.000Z",
      projectName: "Plant",
      projectPathHash: "a".repeat(64),
      observedAt: "2026-01-01T00:00:01.000Z",
    },
    state: "completed",
    freshness: "current",
    staleReason: null,
    createdAt: "2026-01-01T00:00:02.000Z",
    updatedAt: "2026-01-01T00:00:03.000Z",
    completedAt: "2026-01-01T00:00:03.000Z",
    objectCount: 4,
    byteCount: 100,
    documentCount: 1,
    limits: { maxObjects: 100, maxBytes: 1_000, maxDurationMs: 10_000, maxResultsPerQuery: 20 },
    coverage: [{ capability: "snapshot.documents", state: "complete", observedCount: 1, note: "Observed." }],
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("persistent conversation store", () => {
  it("restores conversation metadata and Pi session references", () => {
    const directory = mkdtempSync(join(tmpdir(), "simon-store-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "simon.sqlite");

    const first = new InMemoryStore(databasePath);
    const conversation = first.createConversation({ title: "Persistent", approvalMode: "manual" });
    first.setSessionReference(conversation.conversationId, "session-1", join(directory, "session.jsonl"));
    first.updateConversation(conversation.conversationId, { selectedModel: "test/model" });
    first.close();

    const second = new InMemoryStore(databasePath);
    expect(second.conversations.get(conversation.conversationId)).toMatchObject({
      title: "Persistent",
      piSessionId: "session-1",
      selectedModel: "test/model",
    });
    expect(second.getSessionPath(conversation.conversationId)).toBe(join(directory, "session.jsonl"));
    second.close();
  });

  it("persists and restores an immutable engineering project binding", () => {
    const directory = mkdtempSync(join(tmpdir(), "simon-store-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "simon.sqlite");
    const binding = {
      bindingId: "d07f4af7-95a5-467c-89f5-ded7bc703b62",
      epoch: "5df7d2e5-1c72-4aaf-b98a-cf8525538950",
      processId: 42,
      processStartTime: "2026-11-09T09:00:00.000Z",
      projectName: "Plant",
      projectPathHash: "a".repeat(64),
      observedAt: "2026-11-09T10:00:00.000Z",
    };

    const first = new InMemoryStore(databasePath);
    const conversation = first.createConversation({ title: "Bound", approvalMode: "manual" });
    first.updateConversation(conversation.conversationId, { projectBinding: binding });
    first.close();

    const second = new InMemoryStore(databasePath);
    expect(second.conversations.get(conversation.conversationId)?.projectBinding).toEqual(binding);
    second.close();
  });

  it("migrates an existing conversation table without a project-binding column", () => {
    const directory = mkdtempSync(join(tmpdir(), "simon-store-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "simon.sqlite");
    const database = new DatabaseSync(databasePath);
    database.exec(`
      CREATE TABLE conversations (
        conversation_id TEXT PRIMARY KEY,
        pi_session_id TEXT,
        pi_session_path TEXT,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        selected_model TEXT,
        thinking_level TEXT,
        approval_mode TEXT NOT NULL,
        status TEXT NOT NULL
      );
    `);
    database.close();

    const store = new InMemoryStore(databasePath);
    store.close();
    const inspection = new DatabaseSync(databasePath);
    const columns = inspection.prepare("PRAGMA table_info(conversations)").all() as unknown as Array<{ name: string }>;
    expect(columns.some((column) => column.name === "project_binding_json")).toBe(true);
    inspection.close();
  });

  it("persists and restores snapshot metadata without raw local paths", () => {
    const directory = mkdtempSync(join(tmpdir(), "simon-store-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "simon.sqlite");

    const first = new InMemoryStore(databasePath);
    const conversation = first.createConversation({ title: "Snapshot", approvalMode: "manual" });
    const snapshot = createSnapshot(conversation.conversationId);
    first.saveEngineeringSnapshot(snapshot);
    expect(first.getLatestEngineeringSnapshot(conversation.conversationId)).toEqual(snapshot);
    first.close();

    const inspection = new DatabaseSync(databasePath);
    const row = inspection.prepare("SELECT snapshot_json FROM engineering_snapshots WHERE snapshot_id = ?")
      .get(snapshot.snapshotId) as unknown as { snapshot_json: string };
    inspection.close();
    expect(row.snapshot_json).not.toContain('"projectPath":');
    expect(row.snapshot_json).not.toContain('"exportPath":');
    expect(row.snapshot_json).not.toContain('"artifactPath":');
    expect(row.snapshot_json).not.toMatch(/Users[\\/]/i);

    const second = new InMemoryStore(databasePath);
    expect(second.getEngineeringSnapshot(snapshot.snapshotId)).toMatchObject({
      state: "stale",
      freshness: "stale",
      staleReason: expect.stringMatching(/restarted/),
      binding: snapshot.binding,
    });
    expect(second.getLatestEngineeringSnapshot(conversation.conversationId)?.snapshotId).toBe(snapshot.snapshotId);
    second.close();
  });

  it("indexes normalized engineering records with bounded SQLite FTS5 snippets", () => {
    const directory = mkdtempSync(join(tmpdir(), "simon-store-"));
    temporaryDirectories.push(directory);
    const store = new InMemoryStore(join(directory, "simon.sqlite"));
    const conversation = store.createConversation({ title: "Search snapshot", approvalMode: "manual" });
    const snapshot = createSnapshot(conversation.conversationId);
    store.saveEngineeringSnapshot(snapshot);
    store.indexEngineeringRecords(snapshot, normalizeEngineeringRecords(snapshot, searchableCollection));

    const sourceHits = store.searchEngineeringDocuments(snapshot.snapshotId, "restart delay", 10);
    expect(sourceHits).toHaveLength(1);
    expect(sourceHits[0]).toMatchObject({
      document: { engineeringPath: "Program blocks/RestartControl" },
      score: expect.any(Number),
      snippet: expect.stringContaining("‹restart›"),
    });
    expect(sourceHits[0]?.snippet.length).toBeLessThanOrEqual(2_000);

    const tagHits = store.searchEngineeringDocuments(snapshot.snapshotId, "permissive", 10);
    expect(tagHits[0]?.document).toMatchObject({ kind: "tag", name: "MotorReady" });
    store.close();
  });

  it("invalidates current snapshots by binding identity", () => {
    const directory = mkdtempSync(join(tmpdir(), "simon-store-"));
    temporaryDirectories.push(directory);
    const store = new InMemoryStore(join(directory, "simon.sqlite"));
    const conversation = store.createConversation({ title: "Invalidate snapshot", approvalMode: "manual" });
    const snapshot = createSnapshot(conversation.conversationId);
    store.saveEngineeringSnapshot(snapshot);

    expect(store.markEngineeringSnapshotsStale(
      { bindingId: snapshot.binding.bindingId, epoch: snapshot.binding.epoch },
      "Binding detached.",
    )).toBe(1);
    expect(store.getEngineeringSnapshot(snapshot.snapshotId)).toMatchObject({
      state: "stale",
      freshness: "stale",
      staleReason: "Binding detached.",
    });
    expect(store.markEngineeringSnapshotsStale({}, "Repeated invalidation.")).toBe(0);
    store.close();
  });

  it("adds snapshot persistence to an existing database without losing conversations", () => {
    const directory = mkdtempSync(join(tmpdir(), "simon-store-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "simon.sqlite");
    const first = new InMemoryStore(databasePath);
    const conversation = first.createConversation({ title: "Before migration", approvalMode: "manual" });
    first.close();

    const second = new InMemoryStore(databasePath);
    expect(second.conversations.get(conversation.conversationId)?.title).toBe("Before migration");
    const inspection = new DatabaseSync(databasePath);
    const tables = inspection.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as unknown as Array<{ name: string }>;
    expect(tables.some((table) => table.name === "engineering_snapshots")).toBe(true);
    inspection.close();
    second.close();
  });

  it("deletes persisted snapshots with conversation metadata", () => {
    const directory = mkdtempSync(join(tmpdir(), "simon-store-"));
    temporaryDirectories.push(directory);
    const store = new InMemoryStore(join(directory, "simon.sqlite"));
    const conversation = store.createConversation({ title: "Delete snapshot", approvalMode: "manual" });
    const snapshot = createSnapshot(conversation.conversationId);
    store.saveEngineeringSnapshot(snapshot);

    store.deleteConversation(conversation.conversationId);

    expect(store.getEngineeringSnapshot(snapshot.snapshotId)).toBeNull();
    store.close();
  });

  it("deletes the persisted Pi transcript with conversation metadata", () => {
    const directory = mkdtempSync(join(tmpdir(), "simon-store-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "simon.sqlite");
    const sessionPath = join(directory, "session.jsonl");
    writeFileSync(sessionPath, "session data");

    const store = new InMemoryStore(databasePath);
    const conversation = store.createConversation({ title: undefined, approvalMode: "manual" });
    store.setSessionReference(conversation.conversationId, "session-1", sessionPath);
    store.deleteConversation(conversation.conversationId);

    expect(existsSync(sessionPath)).toBe(false);
    expect(store.conversations.has(conversation.conversationId)).toBe(false);
    store.close();
  });

  it("indexes titles and transcript text with local FTS excerpts", () => {
    const directory = mkdtempSync(join(tmpdir(), "simon-store-"));
    temporaryDirectories.push(directory);
    const store = new InMemoryStore(join(directory, "simon.sqlite"));
    const conversation = store.createConversation({ title: "Pump restart review", approvalMode: "manual" });
    store.indexConversation(conversation.conversationId, [
      { messageId: "u1", role: "user", text: "Explain the restart delay" },
      { messageId: "a1", role: "assistant", text: "The pump uses a five second timer before restarting." },
    ]);

    const results = store.searchConversations("five second timer");
    expect(results).toHaveLength(1);
    expect(results[0]?.conversation.conversationId).toBe(conversation.conversationId);
    expect(results[0]?.matchedRole).toBe("assistant");
    expect(results[0]?.excerpt).toContain("‹five›");
    store.close();
  });

  it("marks a conversation interrupted instead of replaying it", () => {
    const directory = mkdtempSync(join(tmpdir(), "simon-store-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "simon.sqlite");

    const first = new InMemoryStore(databasePath);
    const conversation = first.createConversation({ title: undefined, approvalMode: "manual" });
    first.updateConversation(conversation.conversationId, { status: "running" });
    first.close();

    const second = new InMemoryStore(databasePath);
    expect(second.conversations.get(conversation.conversationId)?.status).toBe("interrupted");
    second.close();
  });
});
