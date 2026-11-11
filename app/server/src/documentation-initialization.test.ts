import { describe, expect, it } from "vitest";

import { initializeDocumentationSources } from "./documentation-initialization.js";
import { DocumentationRetrievalService } from "./documentation-retrieval.js";
import { DocumentationStore } from "./documentation-store.js";

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
});
