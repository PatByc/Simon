import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryStore } from "./store.js";

const temporaryDirectories: string[] = [];

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
