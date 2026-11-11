import { describe, expect, it } from "vitest";

import { DOCUMENTATION_SEARCH_TOOL, DOCUMENTATION_STATUS_TOOL, DocumentationRetrievalToolProvider } from "./documentation-retrieval-tools.js";
import { DocumentationRetrievalService } from "./documentation-retrieval.js";
import { DocumentationStore } from "./documentation-store.js";

const source = {
  sourceId: "a".repeat(64), kind: "installed-help" as const, authority: "official-documentation" as const,
  title: "STEP 7 installed help", product: "STEP 7", version: "V20", update: "Update 7", locale: "en-US",
  canonicalUrl: null, rightsStatus: "local-only" as const, state: "ready" as const, extractionMethod: "installed-zip-html",
  contentDigest: "b".repeat(64), indexedAt: "2026-11-11T19:00:00.000Z", statusNote: "Local.", attributes: {},
};
const topic = {
  topicId: "c".repeat(64), sourceId: source.sourceId, stableKey: "pkg/ref", title: "REF instruction", aliases: ["REF"],
  product: "STEP 7", version: "V20", update: "Update 7", locale: "en-US", contentDigest: "d".repeat(64),
  contentLength: 20, excerpt: "Creates a reference.", explicitScope: "$DEVICE='S7-1500'", attributes: { cpuFamilies: ["S7-1500"], language: "SCL" },
};

describe("DocumentationRetrievalToolProvider", () => {
  it("exposes only status and search with validated cited results", async () => {
    const store = new DocumentationStore(); store.replaceSource(source, [{ topic, content: "Creates a reference." }]);
    const tools = new DocumentationRetrievalToolProvider(new DocumentationRetrievalService(store)).createPiTools();
    expect(tools.map(({ name }) => name)).toEqual([DOCUMENTATION_STATUS_TOOL, DOCUMENTATION_SEARCH_TOOL]);
    const status = await tools[0]!.execute("status", {}, undefined, undefined, {} as never);
    expect(status.details).toMatchObject({ documentationStatus: { topicCount: 1 } });
    const search = await tools[1]!.execute("search", { query: "REF", target: { product: "STEP 7", version: "V20", update: "Update 7", cpuFamily: "S7-1500", language: "SCL", locale: "en-US" } }, undefined, undefined, {} as never);
    expect(search.details).toMatchObject({ documentationSearchResult: { hits: [{ topic: { title: "REF instruction" }, applicability: { state: "exact" } }] } });
  });

  it("does not expose ingestion, refresh, arbitrary source, or convention decision operations", () => {
    const names = new DocumentationRetrievalToolProvider(new DocumentationRetrievalService(new DocumentationStore())).createPiTools().map(({ name }) => name).join(" ");
    expect(names).not.toMatch(/ingest|refresh|url|file|approve|reject|revise|retire/i);
  });
});
