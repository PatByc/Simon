import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

import { DocumentationStore } from "./documentation-store.js";

const digest = (value: string) => value.repeat(64);
const now = "2026-11-11T19:00:00.000Z";
const source = {
  sourceId: digest("a"), kind: "installed-help" as const, authority: "official-documentation" as const,
  title: "STEP 7 installed help", product: "STEP 7", version: "V20", update: "Update 7", locale: "en-US",
  canonicalUrl: null, rightsStatus: "local-only" as const, state: "ready" as const,
  extractionMethod: "installed-zip-html", contentDigest: digest("b"), indexedAt: now,
  statusNote: "Local-only source.", attributes: {},
};
const topic = {
  topicId: digest("c"), sourceId: source.sourceId, stableKey: "pkg/topic", title: "REF",
  aliases: ["Create reference"], product: "STEP 7", version: "V20", update: "Update 7", locale: "en-US",
  contentDigest: digest("d"), contentLength: 12, excerpt: "Reference.", explicitScope: null, attributes: {},
};

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("DocumentationStore", () => {
  it("persists documentation independently across restart", () => {
    const dir = mkdtempSync(join(tmpdir(), "simon-doc-store-")); dirs.push(dir);
    const path = join(dir, "documentation.sqlite");
    const first = new DocumentationStore(path);
    first.replaceSource(source, [{ topic, content: "REF creates a reference." }]);
    first.close();

    const second = new DocumentationStore(path);
    expect(second.listSources()).toEqual([source]);
    expect(second.getTopic(topic.topicId)).toEqual({ topic, content: "REF creates a reference." });
    const lexical = second.searchLexical("creates reference", 10);
    expect(lexical).toHaveLength(1);
    expect(lexical[0]).toMatchObject({ topic, score: expect.any(Number) });
    expect(lexical[0]!.snippet).toContain("<mark>");
    second.close();

    const database = new DatabaseSync(path);
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as unknown as Array<{ name: string }>;
    expect(tables.map(({ name }) => name)).toContain("documentation_sources");
    expect(tables.map(({ name }) => name)).not.toContain("engineering_snapshots");
    database.close();
  });

  it("ranks stronger SQLite BM25 matches before weaker matches", () => {
    const dir = mkdtempSync(join(tmpdir(), "simon-doc-rank-")); dirs.push(dir);
    const store = new DocumentationStore(join(dir, "documentation.sqlite"));
    const weaker = { ...topic, topicId: digest("e"), stableKey: "pkg/other", title: "Other operation", aliases: [] };
    store.replaceSource(source, [
      { topic, content: "Create a reference." },
      { topic: weaker, content: "This unrelated discussion includes ref once." },
    ]);
    expect(store.searchLexical("REF", 2).map((entry) => entry.topic.title)).toEqual(["REF", "Other operation"]);
    store.close();
  });

  it("updates source status without replacing last known-good topics", () => {
    const dir = mkdtempSync(join(tmpdir(), "simon-doc-store-")); dirs.push(dir);
    const path = join(dir, "documentation.sqlite");
    const first = new DocumentationStore(path);
    first.replaceSource(source, [{ topic, content: "last known-good" }]);
    first.updateSource({ ...source, state: "stale", statusNote: "Refresh failed; retained." });
    expect(first.listTopics()).toEqual([{ topic, content: "last known-good" }]);
    first.close();
    const second = new DocumentationStore(path);
    expect(second.getSource(source.sourceId)).toMatchObject({ state: "stale", statusNote: "Refresh failed; retained." });
    expect(second.getTopic(topic.topicId)?.content).toBe("last known-good");
    second.close();
  });

  it("atomically replaces and removes a source's topics", () => {
    const store = new DocumentationStore();
    store.replaceSource(source, [{ topic, content: "first" }]);
    const replacement = { ...topic, topicId: digest("e"), stableKey: "pkg/replacement", title: "MOVE" };
    store.replaceSource(source, [{ topic: replacement, content: "second" }]);
    expect(store.getTopic(topic.topicId)).toBeNull();
    expect(store.listTopics()).toEqual([{ topic: replacement, content: "second" }]);
    store.removeSource(source.sourceId);
    expect(store.listSources()).toEqual([]);
    expect(store.listTopics()).toEqual([]);
  });

  it("preserves the committed index through a database lock and recovers after release", () => {
    const dir = mkdtempSync(join(tmpdir(), "simon-doc-store-")); dirs.push(dir);
    const path = join(dir, "documentation.sqlite");
    const store = new DocumentationStore(path);
    store.replaceSource(source, [{ topic, content: "committed" }]);
    const lock = new DatabaseSync(path); lock.exec("BEGIN EXCLUSIVE");
    expect(() => store.replaceSource({ ...source, statusNote: "replacement" }, [{ topic: { ...topic, title: "Changed" }, content: "changed" }])).toThrow();
    expect(store.getTopic(topic.topicId)?.content).toBe("committed");
    lock.exec("ROLLBACK"); lock.close();
    store.replaceSource({ ...source, statusNote: "replacement" }, [{ topic: { ...topic, title: "Changed" }, content: "changed" }]);
    expect(store.getTopic(topic.topicId)).toMatchObject({ topic: { title: "Changed" }, content: "changed" });
    store.close();
  });

  it("rejects mismatched or duplicate topic identities", () => {
    const store = new DocumentationStore();
    expect(() => store.replaceSource(source, [{ topic: { ...topic, sourceId: digest("f") }, content: "x" }])).toThrow("does not match");
    expect(() => store.replaceSource(source, [{ topic, content: "x" }, { topic, content: "y" }])).toThrow("unique IDs");
  });
});
