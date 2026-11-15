import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConventionEvidencePanel } from "./ConventionEvidencePanel.js";

const now = "2026-11-11T19:00:00.000Z";
const proposedId = "a".repeat(64);
const approvedId = "b".repeat(64);
const revisionId = "c".repeat(64);
const evidence = { evidenceId: "d".repeat(64), authority: "observed-project", sourceId: "snapshot", citation: "PLC/Program blocks/FB_Valve", excerpt: "FB_Valve", observedAt: now };
const draft = { conventionId: proposedId, state: "proposed", title: "Function block prefix", rule: "Use FB_ for function blocks.", rationale: "Observed in authorized examples.", scope: ["function block"], evidence: [evidence], exceptions: ["Vendor blocks."], confidence: "high", createdAt: now, createdBy: "simon-inference" };
const decision = { decisionId: "8afc901e-777c-4f9f-bfac-1727efb1f66d", action: "approve", decidedAt: now, decidedBy: "engineer", note: "Approved after review.", hostRecorded: true };
const revision = { revisionId, conventionId: approvedId, revision: 1, state: "approved", title: "Approved block prefix", rule: "Use FB_ for reusable function blocks.", rationale: "Approved local practice.", scope: ["function block"], evidence: [evidence], exceptions: ["Vendor blocks."], approvedAt: now, decision, supersedesRevisionId: null };
const status = {
  proposed: [{ conventionId: proposedId, authority: "inferred-convention", state: "proposed", title: draft.title, scope: draft.scope, confidence: "high", latestRevisionId: null, latestRevision: null, evidenceCount: 1, exceptionCount: 1, updatedAt: now }],
  active: [{ conventionId: approvedId, authority: "approved-convention", state: "approved", title: revision.title, scope: revision.scope, confidence: null, latestRevisionId: revisionId, latestRevision: 1, evidenceCount: 1, exceptionCount: 1, updatedAt: now }],
  rejected: [{ conventionId: "e".repeat(64), authority: "inferred-convention", state: "rejected", title: "Rejected pattern", scope: ["data block"], confidence: "medium", latestRevisionId: null, latestRevision: null, evidenceCount: 3, exceptionCount: 0, updatedAt: now }],
  retired: [{ conventionId: "f".repeat(64), authority: "approved-convention", state: "retired", title: "Retired pattern", scope: ["tag"], confidence: null, latestRevisionId: "1".repeat(64), latestRevision: 2, evidenceCount: 4, exceptionCount: 1, updatedAt: now }],
};

afterEach(() => vi.unstubAllGlobals());

describe("ConventionEvidencePanel", () => {
  it("shows distinct authority states and expands immutable read-only history", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.endsWith("/api/v1/conventions") ? status : url.includes(approvedId)
        ? { conventionId: approvedId, draft: null, decisions: [decision], revisions: [revision] }
        : { conventionId: proposedId, draft, decisions: [], revisions: [] };
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    const user = userEvent.setup(); render(<ConventionEvidencePanel />);
    expect(await screen.findByText("Function block prefix")).toBeVisible();
    expect(screen.getByText("Approved block prefix")).toBeVisible();
    expect(screen.getByText("Rejected pattern")).toBeVisible();
    expect(screen.getByText("Retired pattern")).toBeVisible();
    expect(screen.getByText("Inferred convention")).toBeVisible();
    expect(screen.getByText("Approved convention")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Function block prefix/ }));
    expect(await screen.findByText("Use FB_ for function blocks.")).toBeVisible();
    expect(screen.getByText("PLC/Program blocks/FB_Valve")).toBeVisible();
    expect(screen.getByText(/No engineer decision is recorded/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Approved block prefix/ }));
    expect(await screen.findByText("Use FB_ for reusable function blocks.")).toBeVisible();
    expect(screen.getAllByText(revisionId).length).toBeGreaterThan(0);
    expect(screen.getByText("Approved after review.")).toBeVisible();
    expect(screen.getByText("Vendor blocks.")).toBeVisible();
    expect(screen.getByText(/Revision 1 · approved/)).toBeVisible();
    for (const name of [/^approve$/i, /^reject$/i, /^revise$/i, /^retire$/i, /^activate$/i, /^infer$/i]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  });

  it("keeps summary evidence visible when history is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/api/v1/conventions")) return new Response(JSON.stringify(status), { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ message: "History record is corrupt." }), { status: 500, headers: { "Content-Type": "application/json" } });
    }));
    const user = userEvent.setup(); render(<ConventionEvidencePanel />); await screen.findByText("Function block prefix");
    await user.click(screen.getByRole("button", { name: /Function block prefix/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("History unavailable");
    expect(screen.getByText("Inferred pattern only. It is not approved guidance.")).toBeVisible();
  });

  it("shows a truthful empty state when no convention records exist", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ proposed: [], active: [], rejected: [], retired: [] }), { status: 200, headers: { "Content-Type": "application/json" } })));
    render(<ConventionEvidencePanel />);
    expect(await screen.findByText(/No convention drafts or revisions are recorded/)).toBeVisible();
  });

  it("shows a recoverable unavailable-service state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Convention service unavailable." }), { status: 503, headers: { "Content-Type": "application/json" } })));
    const user = userEvent.setup(); render(<ConventionEvidencePanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Convention service unavailable");
    expect(screen.getByRole("button", { name: "Retry convention evidence" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Retry convention evidence" }));
  });
});
