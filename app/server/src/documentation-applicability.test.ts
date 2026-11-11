import { describe, expect, it } from "vitest";

import { deriveDocumentationApplicability } from "./documentation-applicability.js";

const target = {
  product: "STEP 7", version: "V20", update: "Update 7", cpuFamily: "S7-1500",
  firmware: "V3.0", language: "SCL", locale: "en-US",
};

const matching = { ...target, explicitScope: "$DEVICE='S7-1500'" };

describe("deriveDocumentationApplicability", () => {
  it("derives exact only when every known target field is explicitly matched", () => {
    const result = deriveDocumentationApplicability(target, matching);
    expect(result.state).toBe("exact");
    expect(result.evidence.every((item) => item.relation === "exact")).toBe(true);
  });

  it("derives compatible when explicit evidence matches but some dimensions are unstated", () => {
    const result = deriveDocumentationApplicability(target, { ...matching, firmware: null, language: null });
    expect(result.state).toBe("compatible");
    expect(result.reasons).toContain("firmware applicability is not stated by the source.");
  });

  it("labels version/update differences as adjacent background", () => {
    expect(deriveDocumentationApplicability(target, { ...matching, version: "V19" }).state).toBe("adjacent");
    expect(deriveDocumentationApplicability(target, { ...matching, update: "Update 6" }).state).toBe("adjacent");
  });

  it("labels product, CPU, firmware, language, or locale differences as conflicting", () => {
    for (const candidate of [
      { ...matching, product: "WinCC" },
      { ...matching, cpuFamily: "S7-1200" },
      { ...matching, firmware: "V2.9" },
      { ...matching, language: "LAD" },
      { ...matching, locale: "de-DE" },
    ]) expect(deriveDocumentationApplicability(target, candidate).state).toBe("conflicting");
  });

  it("keeps applicability unknown when the target or source supplies no comparable facts", () => {
    expect(deriveDocumentationApplicability({ product: null, version: null, update: null, cpuFamily: null, firmware: null, language: null, locale: null }, matching)).toMatchObject({ state: "unknown", evidence: [] });
    expect(deriveDocumentationApplicability(target, { product: null, version: null, update: null, cpuFamily: null, firmware: null, language: null, locale: null, explicitScope: null }).state).toBe("unknown");
  });

  it("normalizes case and whitespace without guessing aliases", () => {
    expect(deriveDocumentationApplicability(target, { ...matching, version: " v20 ", cpuFamily: "s7-1500" }).state).toBe("exact");
    expect(deriveDocumentationApplicability(target, { ...matching, cpuFamily: "1500" }).state).toBe("conflicting");
  });
});
