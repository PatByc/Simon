import { describe, expect, it } from "vitest";

import { checkConventionNamingPrefix } from "./convention-checks.js";

const revision = {
  revisionId: "a".repeat(64), conventionId: "b".repeat(64), revision: 1, state: "approved" as const,
  title: "FB prefix", rule: "Use the prefix 'FB_' for function block names in the observed project scope.", rationale: "Approved.", scope: ["function block"],
  evidence: [{ evidenceId: "c".repeat(64), authority: "observed-project" as const, sourceId: "snapshot", citation: "PLC/FB_A", excerpt: "FB_A", observedAt: "2026-11-11T19:00:00.000Z" }],
  exceptions: ["Vendor blocks."], approvedAt: "2026-11-11T19:00:00.000Z",
  decision: { decisionId: "8afc901e-777c-4f9f-bfac-1727efb1f66d", action: "approve" as const, decidedAt: "2026-11-11T19:00:00.000Z", decidedBy: "engineer", note: "Approved.", hostRecorded: true as const }, supersedesRevisionId: null,
};

describe("deterministic convention checks", () => {
  it("labels textual conformance and deviation without claiming functional verification", () => {
    expect(checkConventionNamingPrefix(revision, { name: "FB_Valve", objectKind: "function block" })).toMatchObject({ checkKind: "deterministic-text-check", status: "conforms", functionalVerification: false, explanation: expect.stringContaining("does not verify program behavior") });
    expect(checkConventionNamingPrefix(revision, { name: "Valve", objectKind: "function block" })).toMatchObject({ status: "deviation", functionalVerification: false, explanation: expect.stringContaining("not a functional defect") });
  });

  it("does not apply inactive, out-of-scope, or acknowledged-exception rules", () => {
    expect(checkConventionNamingPrefix({ ...revision, state: "retired" as const }, { name: "Valve", objectKind: "function block" }).status).toBe("not-applicable");
    expect(checkConventionNamingPrefix(revision, { name: "DB_Data", objectKind: "data block" }).status).toBe("not-applicable");
    expect(checkConventionNamingPrefix(revision, { name: "VendorValve", objectKind: "function block", exceptionAcknowledged: true }).status).toBe("not-applicable");
  });

  it("reports unsupported approved rule shapes as unknown", () => {
    expect(checkConventionNamingPrefix({ ...revision, rule: "Prefer clear names." }, { name: "ClearName", objectKind: "function block" })).toMatchObject({ status: "unknown", functionalVerification: false });
  });
});
