import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => { for (const app of apps.splice(0)) await app.close(); });
const now = "2026-11-11T19:00:00.000Z";
const examples = ["FB_A", "FB_B", "FB_C"].map((name, index) => ({ authorization: "host-authorized", evidenceId: (index + 1).toString(16).padStart(64, "0"), sourceId: "snapshot", citation: `PLC/${name}`, excerpt: name, observedAt: now, objectKind: "function block", name }));

describe("host convention routes", () => {
  it("requires explicit host proposal and decision calls", async () => {
    const app = buildApp(); apps.push(app);
    const proposed = await app.inject({ method: "POST", url: "/api/v1/conventions/proposals", payload: { examples } });
    expect(proposed.statusCode).toBe(201);
    const conventionId = proposed.json().proposals[0].conventionId as string;
    expect((await app.inject({ method: "GET", url: "/api/v1/conventions" })).json()).toMatchObject({ proposed: [{ conventionId }], active: [] });
    const approved = await app.inject({ method: "POST", url: `/api/v1/conventions/${conventionId}/decision`, payload: { action: "approve", decidedBy: "engineer", note: "Approved." } });
    expect(approved.statusCode).toBe(200);
    expect(approved.json()).toMatchObject({ revision: { state: "approved", decision: { hostRecorded: true } } });
  });

  it("rejects caller claims of authorization or approval that do not match strict host contracts", async () => {
    const app = buildApp(); apps.push(app);
    expect((await app.inject({ method: "POST", url: "/api/v1/conventions/proposals", payload: { examples: [{ ...examples[0], authorization: "pi-selected" }] } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: `/api/v1/conventions/${"a".repeat(64)}/decision`, payload: { action: "activate", decidedBy: "pi", note: "Do it." } })).statusCode).toBe(400);
  });
});
