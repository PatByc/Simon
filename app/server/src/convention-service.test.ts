import { describe, expect, it } from "vitest";

import { ConventionService } from "./convention-service.js";

const now = "2026-11-11T19:00:00.000Z";
const examples = ["FB_Valve", "FB_Pump", "FB_Motor"].map((name, index) => ({ authorization: "host-authorized" as const, evidenceId: (index + 1).toString(16).padStart(64, "0"), sourceId: "snapshot", citation: `PLC/${name}`, excerpt: name, observedAt: now, objectKind: "function block", name }));

describe("ConventionService host-controlled decisions", () => {
  it("keeps inferred patterns proposed until a host-recorded approval creates a revision", () => {
    const service = new ConventionService(); const draft = service.propose({ examples }, now)[0]!;
    expect(service.status()).toMatchObject({ proposed: [{ state: "proposed" }], active: [] });
    const revision = service.decide(draft.conventionId, { action: "approve", decidedBy: "engineer", note: "Reviewed." }, now)!;
    expect(revision).toMatchObject({ state: "approved", revision: 1, decision: { action: "approve", decidedBy: "engineer", hostRecorded: true } });
    expect(service.status()).toMatchObject({ proposed: [], active: [{ revisionId: revision.revisionId }] });
    expect(() => service.decide(draft.conventionId, { action: "approve", decidedBy: "engineer", note: "Again." }, now)).toThrow("already been decided");
  });

  it("records rejection without activating guidance", () => {
    const service = new ConventionService(); const draft = service.propose({ examples }, now)[0]!;
    expect(service.decide(draft.conventionId, { action: "reject", decidedBy: "engineer", note: "Not representative." }, now)).toBeNull();
    expect(service.status()).toMatchObject({ proposed: [], active: [], rejectedCount: 1 });
  });

  it("appends immutable revisions and retirement history", () => {
    const service = new ConventionService(); const draft = service.propose({ examples }, now)[0]!;
    const first = service.decide(draft.conventionId, { action: "approve", decidedBy: "engineer", note: "Approved." }, now)!;
    const second = service.revise(draft.conventionId, { title: draft.title, rule: "Use FB_ for reusable function blocks.", rationale: draft.rationale, scope: draft.scope, evidence: draft.evidence, exceptions: ["Vendor blocks."], decidedBy: "lead engineer", note: "Clarified scope." }, "2026-11-11T20:00:00.000Z");
    expect(second).toMatchObject({ revision: 2, state: "approved", supersedesRevisionId: first.revisionId, decision: { action: "supersede" } });
    const retired = service.retire(draft.conventionId, { decidedBy: "lead engineer", note: "No longer applicable." }, "2026-11-11T21:00:00.000Z");
    expect(retired).toMatchObject({ revision: 3, state: "retired", supersedesRevisionId: second.revisionId });
    expect(service.status()).toMatchObject({ active: [], retired: [{ revisionId: retired.revisionId }] });
    expect(service.history(draft.conventionId).revisions.map((revision) => revision.revision)).toEqual([1, 2, 3]);
  });

  it("rejects decisions without a human actor and note", () => {
    const service = new ConventionService(); const draft = service.propose({ examples }, now)[0]!;
    expect(() => service.decide(draft.conventionId, { action: "approve", decidedBy: "", note: "" }, now)).toThrow();
    expect(service.status().proposed).toHaveLength(1);
  });
});
