import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  engineeringDocumentSchema,
  engineeringSnapshotSchema,
  projectBindingSchema,
  type ChatMessage,
  type Conversation,
  type ConversationSearchResult,
  type EngineeringDocument,
  type EngineeringSnapshot,
  type Proposal,
  type Run,
  type StreamEvent,
} from "@simon/contracts";
import type { NormalizedEngineeringRecords } from "./engineering-normalization.js";
import { buildEngineeringSearchDocuments, type LexicalDocumentHit } from "./engineering-retrieval.js";

export interface StoredRun {
  run: Run;
  events: StreamEvent[];
  listeners: Set<(event: StreamEvent) => void>;
}

interface SearchRow {
  conversation_id: string;
  excerpt: string;
  matched_role: "title" | "user" | "assistant";
}

interface EngineeringDocumentSearchRow {
  document_json: string;
  excerpt: string;
  rank: number;
}

interface EngineeringSnapshotRow {
  snapshot_id: string;
  snapshot_json: string;
}

interface ConversationRow {
  conversation_id: string;
  pi_session_id: string | null;
  pi_session_path: string | null;
  title: string;
  created_at: string;
  updated_at: string;
  selected_model: string | null;
  thinking_level: string | null;
  approval_mode: "manual" | "auto";
  status: Conversation["status"];
  project_binding_json: string | null;
}

export class InMemoryStore {
  readonly conversations = new Map<string, Conversation>();
  readonly runs = new Map<string, StoredRun>();
  readonly proposals = new Map<string, Proposal>();
  readonly engineeringSnapshots = new Map<string, EngineeringSnapshot>();
  private readonly sessionPaths = new Map<string, string>();
  private readonly database: DatabaseSync | null;

  constructor(databasePath?: string) {
    if (!databasePath) {
      this.database = null;
      return;
    }
    mkdirSync(dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS conversations (
        conversation_id TEXT PRIMARY KEY,
        pi_session_id TEXT,
        pi_session_path TEXT,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        selected_model TEXT,
        thinking_level TEXT,
        approval_mode TEXT NOT NULL,
        status TEXT NOT NULL,
        project_binding_json TEXT
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS conversation_search USING fts5(
        conversation_id UNINDEXED,
        title,
        matched_role UNINDEXED,
        content,
        tokenize = 'unicode61'
      );
      CREATE TABLE IF NOT EXISTS engineering_snapshots (
        snapshot_id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        binding_id TEXT NOT NULL,
        binding_epoch TEXT NOT NULL,
        project_path_hash TEXT NOT NULL,
        state TEXT NOT NULL,
        freshness TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        FOREIGN KEY(conversation_id) REFERENCES conversations(conversation_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS engineering_snapshots_conversation_updated
        ON engineering_snapshots(conversation_id, updated_at DESC);
      CREATE TABLE IF NOT EXISTS engineering_documents (
        document_id TEXT PRIMARY KEY,
        snapshot_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        engineering_path TEXT NOT NULL,
        document_json TEXT NOT NULL,
        FOREIGN KEY(snapshot_id) REFERENCES engineering_snapshots(snapshot_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS engineering_documents_snapshot_path
        ON engineering_documents(snapshot_id, engineering_path);
      CREATE VIRTUAL TABLE IF NOT EXISTS engineering_document_search USING fts5(
        document_id UNINDEXED,
        snapshot_id UNINDEXED,
        name,
        engineering_path,
        content,
        tokenize = 'unicode61'
      );
    `);
    const conversationColumns = this.database.prepare("PRAGMA table_info(conversations)").all() as unknown as Array<{ name: string }>;
    if (!conversationColumns.some((column) => column.name === "project_binding_json")) {
      this.database.exec("ALTER TABLE conversations ADD COLUMN project_binding_json TEXT");
    }
    this.loadConversations();
    this.loadEngineeringSnapshots();
    this.markEngineeringSnapshotsStale({}, "Simon restarted; reconnect the engineering binding and refresh the snapshot.");
  }

  createConversation(input: { title: string | undefined; approvalMode: "manual" | "auto" }): Conversation {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      conversationId: randomUUID(),
      piSessionId: null,
      title: input.title ?? "New conversation",
      createdAt: now,
      updatedAt: now,
      selectedModel: null,
      thinkingLevel: null,
      approvalMode: input.approvalMode,
      status: "idle",
      projectBinding: null,
    };
    this.conversations.set(conversation.conversationId, conversation);
    this.saveConversation(conversation);
    return conversation;
  }

  updateConversation(conversationId: string, changes: Partial<Pick<Conversation, "title" | "approvalMode" | "selectedModel" | "thinkingLevel" | "status" | "projectBinding">>): Conversation | undefined {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return undefined;
    Object.assign(conversation, changes, { updatedAt: new Date().toISOString() });
    this.saveConversation(conversation);
    return conversation;
  }

  deleteConversation(conversationId: string): boolean {
    const sessionPath = this.sessionPaths.get(conversationId);
    const deleted = this.conversations.delete(conversationId);
    this.sessionPaths.delete(conversationId);
    if (sessionPath) rmSync(sessionPath, { force: true });
    this.database?.prepare("DELETE FROM conversations WHERE conversation_id = ?").run(conversationId);
    this.database?.prepare("DELETE FROM conversation_search WHERE conversation_id = ?").run(conversationId);
    const snapshotIds = [...this.engineeringSnapshots.values()]
      .filter((snapshot) => snapshot.conversationId === conversationId)
      .map((snapshot) => snapshot.snapshotId);
    for (const snapshotId of snapshotIds) {
      this.database?.prepare("DELETE FROM engineering_document_search WHERE snapshot_id = ?").run(snapshotId);
      this.database?.prepare("DELETE FROM engineering_documents WHERE snapshot_id = ?").run(snapshotId);
    }
    this.database?.prepare("DELETE FROM engineering_snapshots WHERE conversation_id = ?").run(conversationId);
    for (const [snapshotId, snapshot] of this.engineeringSnapshots) {
      if (snapshot.conversationId === conversationId) this.engineeringSnapshots.delete(snapshotId);
    }
    return deleted;
  }

  setSessionReference(conversationId: string, sessionId: string, sessionPath: string): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;
    conversation.piSessionId = sessionId;
    conversation.updatedAt = new Date().toISOString();
    this.sessionPaths.set(conversationId, sessionPath);
    this.saveConversation(conversation);
  }

  getSessionPath(conversationId: string): string | undefined {
    return this.sessionPaths.get(conversationId);
  }

  saveConversation(conversation: Conversation): void {
    if (!this.database) return;
    this.database.prepare(`
      INSERT INTO conversations (
        conversation_id, pi_session_id, pi_session_path, title, created_at, updated_at,
        selected_model, thinking_level, approval_mode, status, project_binding_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(conversation_id) DO UPDATE SET
        pi_session_id = excluded.pi_session_id,
        pi_session_path = excluded.pi_session_path,
        title = excluded.title,
        updated_at = excluded.updated_at,
        selected_model = excluded.selected_model,
        thinking_level = excluded.thinking_level,
        approval_mode = excluded.approval_mode,
        status = excluded.status,
        project_binding_json = excluded.project_binding_json
    `).run(
      conversation.conversationId,
      conversation.piSessionId,
      this.sessionPaths.get(conversation.conversationId) ?? null,
      conversation.title,
      conversation.createdAt,
      conversation.updatedAt,
      conversation.selectedModel,
      conversation.thinkingLevel,
      conversation.approvalMode,
      conversation.status,
      conversation.projectBinding ? JSON.stringify(conversation.projectBinding) : null,
    );
  }

  saveEngineeringSnapshot(snapshotValue: EngineeringSnapshot): EngineeringSnapshot {
    const snapshot = engineeringSnapshotSchema.parse(snapshotValue);
    this.engineeringSnapshots.set(snapshot.snapshotId, snapshot);
    this.database?.prepare(`
      INSERT INTO engineering_snapshots (
        snapshot_id, conversation_id, binding_id, binding_epoch, project_path_hash,
        state, freshness, created_at, updated_at, snapshot_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(snapshot_id) DO UPDATE SET
        state = excluded.state,
        freshness = excluded.freshness,
        updated_at = excluded.updated_at,
        snapshot_json = excluded.snapshot_json
    `).run(
      snapshot.snapshotId,
      snapshot.conversationId,
      snapshot.binding.bindingId,
      snapshot.binding.epoch,
      snapshot.binding.projectPathHash,
      snapshot.state,
      snapshot.freshness,
      snapshot.createdAt,
      snapshot.updatedAt,
      JSON.stringify(snapshot),
    );
    return snapshot;
  }

  getEngineeringSnapshot(snapshotId: string): EngineeringSnapshot | null {
    return this.engineeringSnapshots.get(snapshotId) ?? null;
  }

  getLatestEngineeringSnapshot(conversationId: string): EngineeringSnapshot | null {
    return [...this.engineeringSnapshots.values()]
      .filter((snapshot) => snapshot.conversationId === conversationId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
  }

  indexEngineeringRecords(snapshot: EngineeringSnapshot, records: NormalizedEngineeringRecords): void {
    if (!this.database) return;
    const documents = buildEngineeringSearchDocuments(snapshot, records);
    this.database.exec("BEGIN");
    try {
      this.database.prepare("DELETE FROM engineering_document_search WHERE snapshot_id = ?").run(snapshot.snapshotId);
      this.database.prepare("DELETE FROM engineering_documents WHERE snapshot_id = ?").run(snapshot.snapshotId);
      const insertDocument = this.database.prepare(`
        INSERT INTO engineering_documents (
          document_id, snapshot_id, conversation_id, kind, name, engineering_path, document_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const insertSearch = this.database.prepare(`
        INSERT INTO engineering_document_search (
          document_id, snapshot_id, name, engineering_path, content
        ) VALUES (?, ?, ?, ?, ?)
      `);
      for (const document of documents) {
        const json = JSON.stringify(document);
        insertDocument.run(
          document.documentId,
          snapshot.snapshotId,
          snapshot.conversationId,
          document.kind,
          document.name,
          document.engineeringPath,
          json,
        );
        insertSearch.run(
          document.documentId,
          snapshot.snapshotId,
          document.name,
          document.engineeringPath,
          `${document.excerpt}\n${JSON.stringify(document.attributes)}`,
        );
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  searchEngineeringDocuments(snapshotId: string, query: string, limit: number): readonly LexicalDocumentHit[] {
    if (!this.database) return [];
    const tokens = query.toLowerCase().match(/[\p{L}\p{N}_%.-]+/gu) ?? [];
    if (tokens.length === 0) return [];
    const match = tokens.map((token) => `"${token.replaceAll('"', '""')}"*`).join(" AND ");
    const rows = this.database.prepare(`
      SELECT d.document_json,
        snippet(engineering_document_search, 4, '‹', '›', ' … ', 24) AS excerpt,
        bm25(engineering_document_search, 0.0, 0.0, 5.0, 3.0, 1.0) AS rank
      FROM engineering_document_search
      JOIN engineering_documents d ON d.document_id = engineering_document_search.document_id
      WHERE engineering_document_search MATCH ? AND engineering_document_search.snapshot_id = ?
      ORDER BY rank, d.engineering_path
      LIMIT ?
    `).all(match, snapshotId, Math.max(1, Math.min(limit, 500))) as unknown as EngineeringDocumentSearchRow[];
    return rows.map((row) => ({
      document: engineeringDocumentSchema.parse(JSON.parse(row.document_json)) as EngineeringDocument,
      score: 1 / (1 + Math.abs(row.rank)),
      snippet: row.excerpt.trim() || "Matching engineering record.",
    }));
  }

  markEngineeringSnapshotsStale(
    filter: { readonly bindingId?: string; readonly epoch?: string },
    reason: string,
  ): number {
    const staleReason = reason.trim();
    if (!staleReason) throw new Error("Snapshot stale reason is required.");
    const updatedAt = new Date().toISOString();
    let count = 0;
    for (const snapshot of [...this.engineeringSnapshots.values()]) {
      if (snapshot.freshness === "stale") continue;
      if (filter.bindingId && snapshot.binding.bindingId !== filter.bindingId) continue;
      if (filter.epoch && snapshot.binding.epoch !== filter.epoch) continue;
      this.saveEngineeringSnapshot(engineeringSnapshotSchema.parse({
        ...snapshot,
        state: "stale",
        freshness: "stale",
        staleReason,
        updatedAt,
      }));
      count += 1;
    }
    return count;
  }

  indexConversation(conversationId: string, messages: ChatMessage[]): void {
    if (!this.database) return;
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;
    this.database.exec("BEGIN");
    try {
      this.database.prepare("DELETE FROM conversation_search WHERE conversation_id = ?").run(conversationId);
      const insert = this.database.prepare("INSERT INTO conversation_search (conversation_id, title, matched_role, content) VALUES (?, ?, ?, ?)");
      insert.run(conversationId, conversation.title, "title", conversation.title);
      for (const message of messages) {
        insert.run(conversationId, conversation.title, message.role, message.text);
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  searchConversations(query: string, limit = 20): ConversationSearchResult[] {
    if (!this.database) return [];
    const tokens = query.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
    if (tokens.length === 0) return [];
    const match = tokens.map((token) => `"${token.replaceAll('"', '""')}"*`).join(" AND ");
    const rows = this.database.prepare(`
      SELECT conversation_id,
        snippet(conversation_search, 3, '‹', '›', ' … ', 18) AS excerpt,
        matched_role
      FROM conversation_search
      WHERE conversation_search MATCH ?
      ORDER BY bm25(conversation_search)
      LIMIT ?
    `).all(match, Math.max(limit * 4, limit)) as unknown as SearchRow[];
    const seen = new Set<string>();
    const results: ConversationSearchResult[] = [];
    for (const row of rows) {
      if (seen.has(row.conversation_id)) continue;
      const conversation = this.conversations.get(row.conversation_id);
      if (!conversation) continue;
      seen.add(row.conversation_id);
      results.push({ conversation, excerpt: row.excerpt, matchedRole: row.matched_role });
      if (results.length >= limit) break;
    }
    return results;
  }

  createRun(conversationId: string): StoredRun {
    const runId = randomUUID();
    const stored: StoredRun = {
      run: {
        runId,
        conversationId,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        status: "queued",
        lastSequence: 0,
      },
      events: [],
      listeners: new Set(),
    };
    this.runs.set(runId, stored);
    return stored;
  }

  appendEvent(runId: string, event: StreamEvent): void {
    const stored = this.runs.get(runId);
    if (!stored) throw new Error(`Unknown run: ${runId}`);
    if (event.sequence !== stored.run.lastSequence + 1) {
      throw new Error(`Invalid event sequence for run ${runId}`);
    }
    stored.events.push(event);
    stored.run.lastSequence = event.sequence;
    for (const listener of stored.listeners) listener(event);
  }

  close(): void {
    this.database?.close();
  }

  private loadEngineeringSnapshots(): void {
    const rows = this.database?.prepare("SELECT snapshot_id, snapshot_json FROM engineering_snapshots ORDER BY updated_at DESC").all() as unknown as EngineeringSnapshotRow[];
    for (const row of rows ?? []) {
      const snapshot = engineeringSnapshotSchema.parse(JSON.parse(row.snapshot_json));
      if (snapshot.snapshotId !== row.snapshot_id) throw new Error("Persisted engineering snapshot identity mismatch.");
      this.engineeringSnapshots.set(snapshot.snapshotId, snapshot);
    }
  }

  private loadConversations(): void {
    const rows = this.database?.prepare("SELECT * FROM conversations ORDER BY updated_at DESC").all() as unknown as ConversationRow[];
    for (const row of rows ?? []) {
      const status = row.status === "running" ? "interrupted" : row.status;
      const conversation: Conversation = {
        conversationId: row.conversation_id,
        piSessionId: row.pi_session_id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        selectedModel: row.selected_model,
        thinkingLevel: row.thinking_level,
        approvalMode: row.approval_mode,
        status,
        projectBinding: row.project_binding_json
          ? projectBindingSchema.parse(JSON.parse(row.project_binding_json))
          : null,
      };
      this.conversations.set(conversation.conversationId, conversation);
      if (row.pi_session_path) this.sessionPaths.set(conversation.conversationId, row.pi_session_path);
      if (status !== row.status) this.saveConversation(conversation);
    }
  }
}
