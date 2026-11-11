import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import { DocumentationRetrievalService } from "./documentation-retrieval.js";
import { DocumentationStore } from "./documentation-store.js";

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => { for (const app of apps.splice(0)) await app.close(); });

function appWithDocumentation() {
  const store = new DocumentationStore();
  const source = { sourceId: "a".repeat(64), kind: "installed-help" as const, authority: "official-documentation" as const, title: "STEP 7 V20", product: "STEP 7", version: "V20", update: "Update 7", locale: "en-US", canonicalUrl: null, rightsStatus: "local-only" as const, state: "ready" as const, extractionMethod: "installed-zip-html", contentDigest: "b".repeat(64), indexedAt: "2026-11-11T19:00:00.000Z", statusNote: "Local.", attributes: {} };
  const topic = { topicId: "c".repeat(64), sourceId: source.sourceId, stableKey: "pkg/ref", title: "REF instruction", aliases: ["REF"], product: "STEP 7", version: "V20", update: "Update 7", locale: "en-US", contentDigest: "d".repeat(64), contentLength: 20, excerpt: "Creates a reference.", explicitScope: null, attributes: { cpuFamilies: ["S7-1500"], language: "SCL" } };
  store.replaceSource(source, [{ topic, content: "Creates a reference." }]);
  const app = buildApp({ documentationRetrieval: new DocumentationRetrievalService(store) }); apps.push(app); return app;
}

describe("documentation HTTP routes", () => {
  it("returns status and target-aware cited search results", async () => {
    const app = appWithDocumentation();
    expect((await app.inject({ method: "GET", url: "/api/v1/documentation/status" })).json()).toMatchObject({ topicCount: 1, currentSourceCount: 1 });
    const response = await app.inject({ method: "POST", url: "/api/v1/documentation/search", payload: { query: "REF", target: { product: "STEP 7", version: "V20", update: "Update 7", cpuFamily: "S7-1500", firmware: null, language: "SCL", locale: "en-US" }, allowAdjacent: false, limit: 20 } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ hits: [{ topic: { title: "REF instruction" }, applicability: { state: "exact" } }] });
  });

  it("rejects invalid or ambiguous requests without exposing internals", async () => {
    const app = appWithDocumentation();
    const response = await app.inject({ method: "POST", url: "/api/v1/documentation/search", payload: { query: "", target: {} } });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "invalid_request", message: "Invalid documentation search request" });
  });
});
