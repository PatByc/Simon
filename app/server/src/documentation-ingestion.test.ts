import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";

import { createRightsBlockedOnlineSource, InstalledHelpAdapter } from "./documentation-ingestion.js";
import { readBoundedZip } from "./documentation-zip.js";

function zip(entries: readonly { name: string; content: string }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const content = Buffer.from(entry.content);
    const compressed = deflateRawSync(content);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(content.length, 22); local.writeUInt16LE(name.length, 26); name.copy(local, 30);
    locals.push(local, compressed);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(0, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(content.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42); name.copy(central, 46);
    centrals.push(central); offset += local.length + compressed.length;
  }
  const central = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(central.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, eocd]);
}

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const limits = { maxEntries: 20, maxCompressedBytes: 100_000, maxUncompressedBytes: 100_000, maxEntryBytes: 20_000, maxCompressionRatio: 100 };

describe("bounded documentation ZIP ingestion", () => {
  it("reads allowlisted installed HTML topics and captures only source metadata", () => {
    const dir = mkdtempSync(join(tmpdir(), "simon-help-")); dirs.push(dir);
    writeFileSync(join(dir, "ProgSCL.zip"), zip([
      { name: "100/topic.htm", content: `<html><head><title>REF &amp; references</title><meta name="Siemens.TIAHelp.HelpScope" content="$DEVICE='S7-1500'"><meta name="Siemens.TIAHelp.Id" content="ProgSCL/100/topic.htm"></head><body><p>Creates a reference.</p></body></html>` },
      { name: "100/image.png", content: "not html" },
    ]));
    const result = new InstalledHelpAdapter({ root: dir, product: "STEP 7", version: "V20", update: "Update 7", locale: "en-US", packageAllowlist: ["ProgSCL.zip"] }).ingest();
    expect(result.source).toMatchObject({ kind: "installed-help", rightsStatus: "local-only", state: "ready" });
    expect(result.source.attributes).not.toHaveProperty("root");
    expect(result.topics).toHaveLength(1);
    expect(result.topics[0]).toMatchObject({ title: "REF & references", stableKey: "ProgSCL.zip/100/topic.htm" });
    expect(result.topics[0]!.metadata.helpscope).toContain("S7-1500");
  });

  it("normalizes Siemens-style archive separators without weakening traversal checks", () => {
    const entries = readBoundedZip(zip([{ name: "Scope\\HelpScope.xml", content: "<scope />" }]), limits);
    expect(entries[0]?.name).toBe("Scope/HelpScope.xml");
    expect(() => readBoundedZip(zip([{ name: "..\\escape.htm", content: "x" }]), limits)).toThrow("unsafe entry");
  });

  it("rejects unsafe archives, package names, and configured bounds", () => {
    expect(() => readBoundedZip(zip([{ name: "../escape.htm", content: "x" }]), limits)).toThrow("unsafe entry");
    const dir = mkdtempSync(join(tmpdir(), "simon-help-")); dirs.push(dir);
    writeFileSync(join(dir, "a.zip"), zip([{ name: "a.htm", content: "x" }, { name: "b.htm", content: "y" }]));
    expect(() => new InstalledHelpAdapter({ root: dir, product: "STEP 7", version: "V20", update: "7", locale: "en-US", packageAllowlist: ["../a.zip"] })).toThrow("basenames only");
    expect(() => readBoundedZip(zip([{ name: "a.htm", content: "x" }, { name: "b.htm", content: "y" }]), { ...limits, maxEntries: 1 })).toThrow("entry-count");
  });

  it("creates deterministic rights-blocked online source metadata without fetching", () => {
    const input = { title: "TIA Portal V20", product: "STEP 7", version: "V20", update: null, locale: "en-US", canonicalUrl: "https://docs.tia.siemens.cloud/r/en-us/v20/" };
    const first = createRightsBlockedOnlineSource(input);
    expect(first).toMatchObject({ kind: "official-online", state: "blocked", rightsStatus: "blocked", indexedAt: null, contentDigest: null });
    expect(createRightsBlockedOnlineSource(input).sourceId).toBe(first.sourceId);
    expect(createHash("sha256").update(first.sourceId).digest("hex")).toHaveLength(64);
  });
});
