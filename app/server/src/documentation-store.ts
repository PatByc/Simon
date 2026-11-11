import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  documentationSourceSchema,
  documentationTopicSchema,
  type DocumentationSource,
  type DocumentationTopic,
} from "@simon/contracts";

export interface StoredDocumentationTopic {
  readonly topic: DocumentationTopic;
  readonly content: string;
}

export interface LexicalDocumentationHit extends StoredDocumentationTopic {
  readonly score: number;
  readonly snippet: string;
}

interface JsonRow { readonly json: string }
interface TopicRow { readonly topic_json: string; readonly content: string }
interface SearchRow { readonly topic_id: string; readonly excerpt: string; readonly rank: number }

function normalizeOccurrences(value: string, token: string): number {
  let count = 0;
  let offset = 0;
  while ((offset = value.indexOf(token, offset)) >= 0) { count += 1; offset += token.length; }
  return count;
}

export class DocumentationStore {
  private readonly sources = new Map<string, DocumentationSource>();
  private readonly topics = new Map<string, StoredDocumentationTopic>();
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
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS documentation_sources (
        source_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        product TEXT NOT NULL,
        version TEXT,
        update_label TEXT,
        locale TEXT NOT NULL,
        state TEXT NOT NULL,
        indexed_at TEXT,
        source_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS documentation_topics (
        topic_id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        stable_key TEXT NOT NULL,
        title TEXT NOT NULL,
        product TEXT NOT NULL,
        version TEXT,
        update_label TEXT,
        locale TEXT NOT NULL,
        content_digest TEXT NOT NULL,
        topic_json TEXT NOT NULL,
        content TEXT NOT NULL,
        FOREIGN KEY(source_id) REFERENCES documentation_sources(source_id) ON DELETE CASCADE,
        UNIQUE(source_id, stable_key)
      );
      CREATE INDEX IF NOT EXISTS documentation_topics_source_title
        ON documentation_topics(source_id, title);
      CREATE VIRTUAL TABLE IF NOT EXISTS documentation_topic_search USING fts5(
        topic_id UNINDEXED,
        source_id UNINDEXED,
        title,
        aliases,
        content,
        tokenize = 'unicode61'
      );
    `);
    this.load();
  }

  close(): void { this.database?.close(); }

  replaceSource(sourceInput: DocumentationSource, topicInputs: readonly StoredDocumentationTopic[]): void {
    const source = documentationSourceSchema.parse(sourceInput);
    const topics = topicInputs.map(({ topic, content }) => ({
      topic: documentationTopicSchema.parse(topic),
      content,
    }));
    if (topics.some(({ topic }) => topic.sourceId !== source.sourceId)) {
      throw new Error("Documentation topic sourceId does not match the source being replaced.");
    }
    if (new Set(topics.map(({ topic }) => topic.topicId)).size !== topics.length
      || new Set(topics.map(({ topic }) => topic.stableKey)).size !== topics.length) {
      throw new Error("Documentation topics must have unique IDs and stable keys within a source.");
    }

    if (this.database) {
      this.database.exec("BEGIN IMMEDIATE");
      try {
        this.database.prepare(`INSERT OR REPLACE INTO documentation_sources
          (source_id, kind, product, version, update_label, locale, state, indexed_at, source_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(source.sourceId, source.kind, source.product, source.version, source.update, source.locale, source.state, source.indexedAt, JSON.stringify(source));
        this.database.prepare("DELETE FROM documentation_topics WHERE source_id = ?").run(source.sourceId);
        this.database.prepare("DELETE FROM documentation_topic_search WHERE source_id = ?").run(source.sourceId);
        const insert = this.database.prepare(`INSERT INTO documentation_topics
          (topic_id, source_id, stable_key, title, product, version, update_label, locale, content_digest, topic_json, content)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        const insertSearch = this.database.prepare(`INSERT INTO documentation_topic_search
          (topic_id, source_id, title, aliases, content) VALUES (?, ?, ?, ?, ?)`);
        for (const entry of topics) {
          insert.run(
            entry.topic.topicId, source.sourceId, entry.topic.stableKey, entry.topic.title,
            entry.topic.product, entry.topic.version, entry.topic.update, entry.topic.locale,
            entry.topic.contentDigest, JSON.stringify(entry.topic), entry.content,
          );
          insertSearch.run(entry.topic.topicId, source.sourceId, entry.topic.title, entry.topic.aliases.join(" "), entry.content);
        }
        this.database.exec("COMMIT");
      } catch (error) {
        this.database.exec("ROLLBACK");
        throw error;
      }
    }

    this.sources.set(source.sourceId, source);
    for (const [topicId, entry] of this.topics) if (entry.topic.sourceId === source.sourceId) this.topics.delete(topicId);
    for (const entry of topics) this.topics.set(entry.topic.topicId, entry);
  }

  removeSource(sourceId: string): void {
    this.database?.prepare("DELETE FROM documentation_topic_search WHERE source_id = ?").run(sourceId);
    this.database?.prepare("DELETE FROM documentation_sources WHERE source_id = ?").run(sourceId);
    this.sources.delete(sourceId);
    for (const [topicId, entry] of this.topics) if (entry.topic.sourceId === sourceId) this.topics.delete(topicId);
  }

  listSources(): readonly DocumentationSource[] {
    return [...this.sources.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  }

  getSource(sourceId: string): DocumentationSource | null { return this.sources.get(sourceId) ?? null; }

  listTopics(sourceId?: string): readonly StoredDocumentationTopic[] {
    return [...this.topics.values()]
      .filter((entry) => sourceId === undefined || entry.topic.sourceId === sourceId)
      .sort((a, b) => a.topic.stableKey.localeCompare(b.topic.stableKey));
  }

  getTopic(topicId: string): StoredDocumentationTopic | null { return this.topics.get(topicId) ?? null; }

  searchLexical(query: string, limit: number): readonly LexicalDocumentationHit[] {
    const tokens = [...query.toLocaleLowerCase("en-US").matchAll(/[\p{L}\p{N}_]+/gu)].map((match) => match[0]).filter((token) => token.length > 1).slice(0, 12);
    if (tokens.length === 0) return [];
    if (this.database) {
      const expression = tokens.map((token) => `"${token.replace(/"/g, '""')}"*`).join(" AND ");
      const rows = this.database.prepare(`SELECT topic_id, snippet(documentation_topic_search, 4, '<mark>', '</mark>', ' … ', 24) AS excerpt,
        bm25(documentation_topic_search, 4.0, 0.0, 3.0, 2.0, 1.0) AS rank
        FROM documentation_topic_search WHERE documentation_topic_search MATCH ? ORDER BY rank, topic_id LIMIT ?`).all(expression, limit) as unknown as SearchRow[];
      return rows.flatMap((row) => {
        const entry = this.topics.get(row.topic_id);
        return entry ? [{ ...entry, score: 1 / (1 + Math.abs(row.rank)), snippet: row.excerpt }] : [];
      });
    }
    return [...this.topics.values()].flatMap((entry) => {
      const haystack = `${entry.topic.title} ${entry.topic.aliases.join(" ")} ${entry.content}`.toLocaleLowerCase("en-US");
      if (!tokens.every((token) => haystack.includes(token))) return [];
      const score = tokens.reduce((total, token) => total + (normalizeOccurrences(haystack, token)), 0);
      const first = Math.min(...tokens.map((token) => haystack.indexOf(token)).filter((index) => index >= 0));
      const start = Math.max(0, first - 80);
      return [{ ...entry, score, snippet: entry.content.slice(start, start + 400) }];
    }).sort((a, b) => b.score - a.score || a.topic.topicId.localeCompare(b.topic.topicId)).slice(0, limit);
  }

  private load(): void {
    if (!this.database) return;
    const sourceRows = this.database.prepare("SELECT source_json AS json FROM documentation_sources").all() as unknown as JsonRow[];
    for (const row of sourceRows) {
      const source = documentationSourceSchema.parse(JSON.parse(row.json));
      this.sources.set(source.sourceId, source);
    }
    const topicRows = this.database.prepare("SELECT topic_json, content FROM documentation_topics").all() as unknown as TopicRow[];
    for (const row of topicRows) {
      const topic = documentationTopicSchema.parse(JSON.parse(row.topic_json));
      this.topics.set(topic.topicId, { topic, content: row.content });
    }
  }
}
