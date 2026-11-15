import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_INSTALLED_HELP_LIMITS } from "./documentation-ingestion.js";
import { initializeDocumentationSources } from "./documentation-initialization.js";
import { DocumentationRetrievalService } from "./documentation-retrieval.js";
import { DocumentationStore } from "./documentation-store.js";

function zip(entries: readonly { name: string; content: string }[]): Buffer {
  const locals: Buffer[] = []; const centrals: Buffer[] = []; let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name); const content = Buffer.from(entry.content); const compressed = deflateRawSync(content);
    const local = Buffer.alloc(30 + name.length); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(8, 8); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(content.length, 22); local.writeUInt16LE(name.length, 26); name.copy(local, 30); locals.push(local, compressed);
    const central = Buffer.alloc(46 + name.length); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8); central.writeUInt16LE(8, 10); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(content.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42); name.copy(central, 46); centrals.push(central); offset += local.length + compressed.length;
  }
  const central = Buffer.concat(centrals); const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(central.length, 12); eocd.writeUInt32LE(offset, 16); return Buffer.concat([...locals, central, eocd]);
}

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const target = { product: "STEP 7", version: "V20", update: "Update 7", cpuFamily: null, firmware: null, language: null, locale: "en-US" };

describe("documentation source initialization", () => {
  it("fails closed with separate local failure and rights-blocked online records", () => {
    const store = new DocumentationStore();
    initializeDocumentationSources(store, { installedRoot: "Z:/definitely-missing-simon-help", packageAllowlist: ["ProgSCL.zip"] });
    const status = new DocumentationRetrievalService(store).status();
    expect(status.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "installed-help", state: "failed", rightsStatus: "local-only" }),
      expect.objectContaining({ kind: "official-online", state: "blocked", rightsStatus: "blocked" }),
    ]));
    expect(status).toMatchObject({ currentSourceCount: 0, blockedSourceCount: 1, partial: true });
  });

  it("reuses an unchanged index and preserves indexed identity across warm initialization", () => {
    const root = mkdtempSync(join(tmpdir(), "simon-help-init-")); dirs.push(root);
    const archive = zip([{ name: "100/topic.htm", content: "<html><head><title>REF instruction</title></head><body>Creates a reference.</body></html>" }]);
    writeFileSync(join(root, "ProgSCL.zip"), archive);
    const store = new DocumentationStore(); const config = { installedRoot: root, packageAllowlist: ["ProgSCL.zip"] };
    initializeDocumentationSources(store, config, "2026-11-11T19:00:00.000Z");
    const first = store.listSources().find((source) => source.kind === "installed-help")!;
    initializeDocumentationSources(store, config, "2026-11-11T20:00:00.000Z");
    const second = store.listSources().find((source) => source.kind === "installed-help")!;
    expect(second).toMatchObject({ sourceId: first.sourceId, contentDigest: first.contentDigest, indexedAt: first.indexedAt, state: "ready" });
    expect(store.listTopics(second.sourceId)).toHaveLength(1);
  });

  it("retains searchable last known-good topics when refresh fails, then recovers without reindexing", () => {
    const root = mkdtempSync(join(tmpdir(), "simon-help-init-")); dirs.push(root);
    const archive = zip([{ name: "100/topic.htm", content: "<html><head><title>REF instruction</title></head><body>Creates a reference.</body></html>" }]);
    const packagePath = join(root, "ProgSCL.zip"); writeFileSync(packagePath, archive);
    const store = new DocumentationStore(); const config = { installedRoot: root, packageAllowlist: ["ProgSCL.zip"] };
    initializeDocumentationSources(store, config, "2026-11-11T19:00:00.000Z");
    const good = store.listSources().find((source) => source.kind === "installed-help")!;
    writeFileSync(packagePath, "corrupt");
    initializeDocumentationSources(store, config, "2026-11-11T20:00:00.000Z");
    const stale = store.getSource(good.sourceId)!;
    expect(stale).toMatchObject({ state: "stale", indexedAt: good.indexedAt, contentDigest: good.contentDigest });
    expect(stale.statusNote).toContain("last known-good local index is retained");
    expect(stale.statusNote).not.toContain(root);
    const retrieval = new DocumentationRetrievalService(store);
    expect(retrieval.search({ query: "REF instruction", target, allowAdjacent: false, limit: 20 })).toMatchObject({ hits: [{ topic: { title: "REF instruction" } }], partial: true });
    writeFileSync(packagePath, archive);
    initializeDocumentationSources(store, config, "2026-11-11T21:00:00.000Z");
    expect(store.getSource(good.sourceId)).toMatchObject({ state: "ready", indexedAt: good.indexedAt });
    expect(store.listTopics(good.sourceId)).toHaveLength(1);
  });

  it("retains and recovers from missing packages, unsafe archives, byte limits, and interrupted ingestion", () => {
    const root = mkdtempSync(join(tmpdir(), "simon-help-init-")); dirs.push(root);
    const archive = zip([{ name: "100/topic.htm", content: "<html><head><title>REF instruction</title></head><body>Good.</body></html>" }]);
    const packagePath = join(root, "ProgSCL.zip"); writeFileSync(packagePath, archive);
    const store = new DocumentationStore(); const config = { installedRoot: root, packageAllowlist: ["ProgSCL.zip"] };
    initializeDocumentationSources(store, config, "2026-11-11T19:00:00.000Z");
    const goodId = store.listSources().find((source) => source.kind === "installed-help")!.sourceId;
    const assertRetained = () => { expect(store.getSource(goodId)?.state).toBe("stale"); expect(store.listTopics(goodId)).toHaveLength(1); };

    rmSync(packagePath); initializeDocumentationSources(store, config, "2026-11-11T20:00:00.000Z"); assertRetained();
    writeFileSync(packagePath, zip([{ name: "../escape.htm", content: "unsafe" }])); initializeDocumentationSources(store, config, "2026-11-11T20:01:00.000Z"); assertRetained();
    writeFileSync(packagePath, archive); initializeDocumentationSources(store, { ...config, limits: { ...DEFAULT_INSTALLED_HELP_LIMITS, maxTotalCompressedBytes: 1 } }, "2026-11-11T20:02:00.000Z"); assertRetained();
    initializeDocumentationSources(store, { ...config, limits: { ...DEFAULT_INSTALLED_HELP_LIMITS, maxDurationMs: -1 } }, "2026-11-11T20:03:00.000Z"); assertRetained();
    initializeDocumentationSources(store, config, "2026-11-11T21:00:00.000Z");
    expect(store.getSource(goodId)?.state).toBe("ready"); expect(store.listTopics(goodId)).toHaveLength(1);
  });

  it("replaces changed content atomically and removes superseded installed-source records", () => {
    const root = mkdtempSync(join(tmpdir(), "simon-help-init-")); dirs.push(root);
    const packagePath = join(root, "ProgSCL.zip");
    writeFileSync(packagePath, zip([{ name: "100/topic.htm", content: "<html><head><title>REF instruction</title></head><body>First.</body></html>" }]));
    const store = new DocumentationStore(); const config = { installedRoot: root, packageAllowlist: ["ProgSCL.zip"] };
    initializeDocumentationSources(store, config, "2026-11-11T19:00:00.000Z");
    const firstId = store.listSources().find((source) => source.kind === "installed-help")!.sourceId;
    writeFileSync(packagePath, zip([{ name: "100/topic.htm", content: "<html><head><title>REF instruction</title></head><body>Changed.</body></html>" }]));
    initializeDocumentationSources(store, config, "2026-11-11T20:00:00.000Z");
    const installed = store.listSources().filter((source) => source.kind === "installed-help");
    expect(installed).toHaveLength(1); expect(installed[0]!.sourceId).not.toBe(firstId);
    expect(store.listTopics(installed[0]!.sourceId)[0]?.content).toContain("Changed.");
  });
});
