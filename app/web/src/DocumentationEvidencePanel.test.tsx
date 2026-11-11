import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DocumentationEvidencePanel } from "./DocumentationEvidencePanel.js";

const now = "2026-11-11T19:00:00.000Z";
const source = { sourceId: "a".repeat(64), kind: "installed-help", authority: "official-documentation", title: "STEP 7 installed help V20 Update 7", product: "STEP 7", version: "V20", update: "Update 7", locale: "en-US", canonicalUrl: null, rightsStatus: "local-only", state: "ready", extractionMethod: "installed-zip-html", contentDigest: "b".repeat(64), indexedAt: now, statusNote: "Installed help is indexed locally.", attributes: {} };
const topic = { topicId: "c".repeat(64), sourceId: source.sourceId, stableKey: "pkg/ref", title: "REF instruction", aliases: ["REF"], product: "STEP 7", version: "V20", update: "Update 7", locale: "en-US", contentDigest: "d".repeat(64), contentLength: 20, excerpt: "Creates a reference.", explicitScope: null, attributes: {} };
const applicability = { state: "compatible", evidence: [{ field: "version", targetValue: "V20", sourceValue: "V20", relation: "exact" }, { field: "firmware", targetValue: "V3.0", sourceValue: null, relation: "missing" }], reasons: ["version matches 'V20'.", "firmware applicability is not stated by the source."], explicitScope: null };

afterEach(() => vi.unstubAllGlobals());

describe("DocumentationEvidencePanel", () => {
  it("shows source status and performs an accessible target-aware search", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.endsWith("/status")
        ? { sources: [source], topicCount: 1, currentSourceCount: 1, blockedSourceCount: 0, partial: false, statusNote: "Ready." }
        : { query: "REF", target: { product: "STEP 7", version: "V20", update: "Update 7", cpuFamily: null, firmware: null, language: null, locale: "en-US" }, hits: [{ source, topic, matchKind: "exact-alias", score: 80, snippet: "Creates a reference.", applicability, citation: { citationId: "e".repeat(64), sourceId: source.sourceId, topicId: topic.topicId, sourceKind: "installed-help", sourceTitle: source.title, topicTitle: topic.title, product: "STEP 7", version: "V20", update: "Update 7", locale: "en-US", applicability, canonicalUrl: null, indexedAt: now } }], partial: false, statusNote: "Found one." };
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    const user = userEvent.setup(); render(<DocumentationEvidencePanel />);
    expect(await screen.findByText("STEP 7 installed help V20 Update 7")).toBeVisible();
    expect(screen.getByLabelText("version")).toHaveValue("V20");
    await user.type(screen.getByLabelText("Search indexed documentation"), "REF");
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("REF instruction")).toBeVisible();
    expect(screen.getByText(/compatible/)).toBeVisible();
    await user.click(screen.getByText("Applicability evidence"));
    expect(screen.getByText("firmware applicability is not stated by the source.")).toBeVisible();
  });

  it("clears prior evidence when a later search fails", async () => {
    let searches = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/status")) return new Response(JSON.stringify({ sources: [source], topicCount: 1, currentSourceCount: 1, blockedSourceCount: 0, partial: false, statusNote: "Ready." }), { status: 200, headers: { "Content-Type": "application/json" } });
      searches += 1;
      if (searches > 1) return new Response(JSON.stringify({ message: "Documentation query is ambiguous." }), { status: 409, headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ query: "REF", target: { product: "STEP 7", version: "V20", update: "Update 7", cpuFamily: null, firmware: null, language: null, locale: "en-US" }, hits: [{ source, topic, matchKind: "exact-alias", score: 80, snippet: "Creates a reference.", applicability, citation: { citationId: "e".repeat(64), sourceId: source.sourceId, topicId: topic.topicId, sourceKind: "installed-help", sourceTitle: source.title, topicTitle: topic.title, product: "STEP 7", version: "V20", update: "Update 7", locale: "en-US", applicability, canonicalUrl: null, indexedAt: now } }], partial: false, statusNote: "Found." }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    const user = userEvent.setup(); render(<DocumentationEvidencePanel />); await screen.findByText(source.title);
    const search = screen.getByLabelText("Search indexed documentation"); await user.type(search, "REF"); await user.click(screen.getByRole("button", { name: "Search" })); await screen.findByText("REF instruction");
    await user.clear(search); await user.type(search, "duplicate"); await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("ambiguous");
    expect(screen.queryByText("REF instruction")).not.toBeInTheDocument();
  });
});
