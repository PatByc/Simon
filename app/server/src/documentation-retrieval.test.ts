import { describe, expect, it } from "vitest";

import { createRightsBlockedOnlineSource } from "./documentation-ingestion.js";
import { DocumentationAmbiguityError, DocumentationRetrievalService } from "./documentation-retrieval.js";
import { DocumentationStore } from "./documentation-store.js";

const now = "2026-11-11T19:00:00.000Z";
const target = { product: "STEP 7", version: "V20", update: "Update 7", cpuFamily: "S7-1500", firmware: null, language: "SCL", locale: "en-US" };
const source = (id: string, version = "V20", update = "Update 7") => ({
  sourceId: id.repeat(64), kind: "installed-help" as const, authority: "official-documentation" as const,
  title: `STEP 7 ${version}`, product: "STEP 7", version, update, locale: "en-US", canonicalUrl: null,
  rightsStatus: "local-only" as const, state: "ready" as const, extractionMethod: "installed-zip-html",
  contentDigest: "f".repeat(64), indexedAt: now, statusNote: "Local.", attributes: {},
});
const topic = (sourceId: string, id: string, stableKey: string, title = "REF: Create a reference") => ({
  topicId: id.repeat(64), sourceId, stableKey, title, aliases: ["REF"], product: "STEP 7",
  version: sourceId === "b".repeat(64) ? "V19" : "V20", update: sourceId === "b".repeat(64) ? "Update 4" : "Update 7",
  locale: "en-US", contentDigest: "e".repeat(64), contentLength: 40, excerpt: "Creates a reference.",
  explicitScope: "$DEVICE='S7-1500'", attributes: { cpuFamilies: ["S7-1500"], language: "SCL" },
});

describe("DocumentationRetrievalService exact retrieval", () => {
  it("matches exact key, title, and alias with stable citations", () => {
    const store = new DocumentationStore(); const s = source("a"); const t = topic(s.sourceId, "c", "ProgSCL/topic");
    store.replaceSource(s, [{ topic: t, content: "Creates a reference for an S7-1500." }]);
    const service = new DocumentationRetrievalService(store);
    expect(service.search({ query: t.stableKey, limit: 20, target, allowAdjacent: false }).hits[0]?.matchKind).toBe("exact-key");
    expect(service.search({ query: t.title.toLowerCase(), limit: 20, target, allowAdjacent: false }).hits[0]?.matchKind).toBe("exact-title");
    const first = service.search({ query: "REF", limit: 20, target, allowAdjacent: false }).hits[0]!;
    const second = service.search({ query: "REF", limit: 20, target, allowAdjacent: false }).hits[0]!;
    expect(first).toMatchObject({ matchKind: "exact-alias", applicability: { state: "exact" } });
    expect(first.citation.citationId).toBe(second.citation.citationId);
  });

  it("falls back to bounded lexical search only when no exact match exists", () => {
    const store = new DocumentationStore(); const s = source("a"); const exact = topic(s.sourceId, "c", "pkg/ref");
    const lexical = { ...topic(s.sourceId, "d", "pkg/move", "MOVE instruction"), aliases: ["MOVE"] };
    store.replaceSource(s, [
      { topic: exact, content: "REF creates a reference for an S7-1500." },
      { topic: lexical, content: "MOVE copies a source value into a destination value." },
    ]);
    const service = new DocumentationRetrievalService(store);
    const result = service.search({ query: "source destination", limit: 20, target, allowAdjacent: false });
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]).toMatchObject({ matchKind: "lexical", topic: { title: "MOVE instruction" } });
    expect(service.search({ query: "REF", limit: 20, target, allowAdjacent: false }).hits).toHaveLength(1);
    expect(service.search({ query: "REF", limit: 20, target, allowAdjacent: false }).hits[0]?.matchKind).toBe("exact-alias");
  });

  it("does not replace an exact-but-conflicting topic with lexical lookalikes", () => {
    const store = new DocumentationStore(); const s = source("a"); const exact = topic(s.sourceId, "c", "pkg/ref");
    const lookalike = { ...topic(s.sourceId, "d", "pkg/lookalike", "Reference overview"), aliases: [] };
    store.replaceSource(s, [{ topic: exact, content: "Exact S7-1500 reference topic." }, { topic: lookalike, content: "REF Create a reference for broad devices." }]);
    const mismatched = { ...target, cpuFamily: "S7-1200" };
    expect(new DocumentationRetrievalService(store).search({ query: exact.title, limit: 20, target: mismatched, allowAdjacent: false }).hits).toEqual([]);
  });

  it("excludes conflicting/adjacent records unless adjacent background is requested", () => {
    const store = new DocumentationStore(); const old = source("b", "V19", "Update 4"); const t = topic(old.sourceId, "d", "old/ref");
    store.replaceSource(old, [{ topic: t, content: "Older reference guidance." }]);
    const service = new DocumentationRetrievalService(store);
    expect(service.search({ query: "REF", limit: 20, target, allowAdjacent: false }).hits).toEqual([]);
    expect(service.search({ query: "REF", limit: 20, target, allowAdjacent: true }).hits[0]?.applicability.state).toBe("adjacent");
  });

  it("fails closed on duplicate exact names and permits exact-key disambiguation", () => {
    const store = new DocumentationStore(); const s = source("a"); const one = topic(s.sourceId, "c", "pkg/one"); const two = topic(s.sourceId, "d", "pkg/two");
    store.replaceSource(s, [{ topic: one, content: "one" }, { topic: two, content: "two" }]);
    const service = new DocumentationRetrievalService(store);
    expect(() => service.search({ query: one.title, limit: 20, target, allowAdjacent: false })).toThrow(DocumentationAmbiguityError);
    expect(service.search({ query: two.stableKey, limit: 20, target, allowAdjacent: false }).hits[0]?.topic.topicId).toBe(two.topicId);
  });

  it("reports independent source status including rights-blocked online metadata", () => {
    const store = new DocumentationStore(); const s = source("a"); store.replaceSource(s, []);
    const blocked = createRightsBlockedOnlineSource({ title: "TIA docs", product: "STEP 7", version: "V20", update: null, locale: "en-US", canonicalUrl: "https://docs.tia.siemens.cloud/r/en-us/v20/" });
    store.replaceSource(blocked, []);
    expect(new DocumentationRetrievalService(store).status()).toMatchObject({ topicCount: 0, currentSourceCount: 1, blockedSourceCount: 1, partial: true });
  });
});
