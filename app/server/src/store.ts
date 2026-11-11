import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { projectBindingSchema, type ChatMessage, type Conversation, type ConversationSearchResult, type Proposal, type Run, type StreamEvent } from "@simon/contracts";

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
    `);
    const conversationColumns = this.database.prepare("PRAGMA table_info(conversations)").all() as unknown as Array<{ name: string }>;
    if (!conversationColumns.some((column) => column.name === "project_binding_json")) {
      this.database.exec("ALTER TABLE conversations ADD COLUMN project_binding_json TEXT");
    }
    this.loadConversations();
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
