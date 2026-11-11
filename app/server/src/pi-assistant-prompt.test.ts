import { describe, expect, it } from "vitest";

import { createRestrictedResourceLoader } from "./pi-assistant.js";
import { getRuntimePolicy } from "./runtime-policy.js";

describe("Pi engineering grounding prompt", () => {
  it("requires snapshot retrieval, source-linked paths, freshness, and explicit limitations", () => {
    const loader = createRestrictedResourceLoader(
      getRuntimePolicy({ SIMON_ENGINEERING_MODE: "tia-readonly" }),
      "Bound project",
    );
    const prompt = loader.getSystemPrompt();

    expect(prompt).toContain("check snapshot status first");
    expect(prompt).toContain("snapshot search/reference tools");
    expect(prompt).toContain("Cite the returned engineering path");
    expect(prompt).toContain("citation freshness and coverage");
    expect(prompt).toContain("missing, stale, partial, ambiguous");
    expect(prompt).toContain("never fill gaps from assumptions");
  });
});
