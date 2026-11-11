import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ConventionStore } from "./convention-store.js";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const now = "2026-11-11T19:00:00.000Z";
const evidence = { evidenceId: "a".repeat(64), authority: "observed-project" as const, sourceId: "snapshot", citation: "PLC/FB_A", excerpt: "FB_A", observedAt: now };
const draft = { conventionId: "b".repeat(64), state: "proposed" as const, title: "FB prefix", rule: "Use FB_", rationale: "Observed.", scope: ["function block"], evidence: [evidence], exceptions: [], confidence: "high" as const, createdAt: now, createdBy: "simon-inference" as const };
const decision = { decisionId: "8afc901e-777c-4f9f-bfac-1727efb1f66d", action: "approve" as const, decidedAt: now, decidedBy: "engineer", note: "Approved.", hostRecorded: true as const };
const revision = { revisionId: "c".repeat(64), conventionId: draft.conventionId, revision: 1, state: "approved" as const, title: draft.title, rule: draft.rule, rationale: draft.rationale, scope: draft.scope, evidence: draft.evidence, exceptions: draft.exceptions, approvedAt: now, decision, supersedesRevisionId: null };

describe("ConventionStore", () => {
  it("persists append-only drafts, decisions, and revisions across restart", () => {
    const dir = mkdtempSync(join(tmpdir(), "simon-conventions-")); dirs.push(dir); const path = join(dir, "conventions.sqlite");
    const first = new ConventionStore(path); first.appendDraft(draft); first.appendDecision(draft.conventionId, decision); first.appendRevision(revision); first.close();
    const second = new ConventionStore(path);
    expect(second.getDraft(draft.conventionId)).toEqual(draft);
    expect(second.listDecisions(draft.conventionId)).toEqual([{ conventionId: draft.conventionId, decision }]);
    expect(second.listRevisions(draft.conventionId)).toEqual([revision]);
    second.close();
  });

  it("refuses identity reuse or revision-number mutation", () => {
    const store = new ConventionStore(); store.appendDraft(draft); store.appendRevision(revision);
    expect(() => store.appendDraft({ ...draft, rule: "Changed" })).toThrow("different content");
    expect(() => store.appendRevision({ ...revision, revisionId: "d".repeat(64), rule: "Changed" })).toThrow("already exists");
  });
});
