import { describe, expect, it } from "vitest";

import { ConventionService } from "./convention-service.js";
import { CONVENTION_SEARCH_TOOL, CONVENTION_STATUS_TOOL, ConventionToolProvider } from "./convention-tools.js";

const now = "2026-11-11T19:00:00.000Z";
const examples = ["FB_A", "FB_B", "FB_C"].map((name, index) => ({ authorization: "host-authorized" as const, evidenceId: (index + 1).toString(16).padStart(64, "0"), sourceId: "snapshot", citation: `PLC/${name}`, excerpt: name, observedAt: now, objectKind: "function block", name }));

describe("ConventionToolProvider", () => {
  it("returns counts plus approved revisions only", async () => {
    const service = new ConventionService(); const draft = service.propose({ examples }, now)[0]!;
    const tools = new ConventionToolProvider(service).createPiTools();
    expect(tools.map(({ name }) => name)).toEqual([CONVENTION_STATUS_TOOL, CONVENTION_SEARCH_TOOL]);
    expect((await tools[0]!.execute("status", {}, undefined, undefined, {} as never)).details).toMatchObject({ conventionStatus: { proposedCount: 1, activeCount: 0 } });
    expect((await tools[1]!.execute("search", { query: "FB_" }, undefined, undefined, {} as never)).details).toMatchObject({ approvedConventionSearch: { hits: [] } });
    const revision = service.decide(draft.conventionId, { action: "approve", decidedBy: "engineer", note: "Approved." }, now)!;
    expect((await tools[1]!.execute("search", { query: "FB_" }, undefined, undefined, {} as never)).details).toMatchObject({ approvedConventionSearch: { hits: [{ authority: "approved-convention", revision: { revisionId: revision.revisionId } }] } });
  });

  it("exposes no proposal or decision operation", () => {
    const names = new ConventionToolProvider(new ConventionService()).createPiTools().map(({ name }) => name);
    for (const forbidden of ["simon_convention_propose", "simon_convention_approve", "simon_convention_reject", "simon_convention_revise", "simon_convention_retire", "simon_convention_activate"]) expect(names).not.toContain(forbidden);
  });
});
