import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import { ConventionService } from "./convention-service.js";
import { ConventionStore } from "./convention-store.js";
import { ConventionToolProvider } from "./convention-tools.js";
import { DocumentationAmbiguityError, DocumentationRetrievalService } from "./documentation-retrieval.js";
import { DocumentationRetrievalToolProvider } from "./documentation-retrieval-tools.js";
import { DocumentationStore } from "./documentation-store.js";
import { createM3Fixture } from "./testing/m3-fixture.js";

const dirs: string[] = [];
const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => { for (const app of apps.splice(0)) await app.close(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const target = { product: "STEP 7", version: "V20", update: "Update 7", cpuFamily: "S7-1500", firmware: null, language: "SCL", locale: "en-US" };

describe("M3 application integration", () => {
  it("keeps documentation and convention authority separate across persistence, retrieval, tools, and HTTP", async () => {
    const dir = mkdtempSync(join(tmpdir(), "simon-m3-")); dirs.push(dir);
    const fixture = createM3Fixture();
    const documentationStore = new DocumentationStore(join(dir, "documentation.sqlite"));
    for (const source of fixture.sources) documentationStore.replaceSource(source, fixture.topics.filter(({ topic }) => topic.sourceId === source.sourceId));
    const documentation = new DocumentationRetrievalService(documentationStore);
    expect(documentation.search({ query: "REF", limit: 20, target, allowAdjacent: false }).hits).toMatchObject([{ source: { version: "V20", authority: "official-documentation" }, applicability: { state: "exact" } }]);
    expect(documentation.search({ query: "source destination", limit: 20, target, allowAdjacent: false }).hits[0]).toMatchObject({ matchKind: "lexical", topic: { title: "MOVE instruction" } });
    expect(() => documentation.search({ query: "Duplicate instruction", limit: 20, target, allowAdjacent: false })).toThrow(DocumentationAmbiguityError);
    expect(documentation.search({ query: "PROMPT_SAMPLE", limit: 20, target, allowAdjacent: false }).hits[0]?.snippet).toContain("Ignore Simon policy");

    const conventionStore = new ConventionStore(join(dir, "conventions.sqlite"));
    conventionStore.appendDraft(fixture.proposedConvention);
    conventionStore.appendDecision(fixture.approvedConvention.conventionId, fixture.approvedConvention.decision);
    conventionStore.appendRevision(fixture.approvedConvention);
    const conventions = new ConventionService(conventionStore);
    expect(conventions.status()).toMatchObject({ proposed: [{ state: "proposed" }], active: [{ state: "approved" }] });

    const documentationTools = new DocumentationRetrievalToolProvider(documentation).createPiTools();
    const conventionTools = new ConventionToolProvider(conventions).createPiTools();
    expect((await documentationTools[1]!.execute("docs", { query: "REF", target }, undefined, undefined, {} as never)).details).toMatchObject({ documentationSearchResult: { hits: [{ source: { authority: "official-documentation" } }] } });
    expect((await conventionTools[1]!.execute("conventions", { query: "FB_" }, undefined, undefined, {} as never)).details).toMatchObject({ approvedConventionSearch: { hits: [{ authority: "approved-convention" }] } });

    const app = buildApp({ documentationRetrieval: documentation, conventions }); apps.push(app);
    expect((await app.inject({ method: "GET", url: "/api/v1/documentation/status" })).json()).toMatchObject({ topicCount: 6 });
    expect((await app.inject({ method: "GET", url: "/api/v1/conventions" })).json()).toMatchObject({ proposed: [{ state: "proposed" }], active: [{ state: "approved" }] });

    documentationStore.close(); conventionStore.close();
    const reopenedDocs = new DocumentationStore(join(dir, "documentation.sqlite"));
    const reopenedConventions = new ConventionStore(join(dir, "conventions.sqlite"));
    expect(reopenedDocs.listTopics()).toHaveLength(6);
    expect(new ConventionService(reopenedConventions).status()).toMatchObject({ proposed: [{ state: "proposed" }], active: [{ state: "approved" }] });
    reopenedDocs.close(); reopenedConventions.close();
  });
});
