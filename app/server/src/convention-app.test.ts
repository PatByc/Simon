import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import { ConventionService } from "./convention-service.js";

const now = "2026-11-11T19:00:00.000Z";
const examples = ["FB_A", "FB_B", "FB_C"].map((name, index) => ({ authorization: "host-authorized" as const, evidenceId: (index + 1).toString(16).padStart(64, "0"), sourceId: "snapshot", citation: `PLC/${name}`, excerpt: name, observedAt: now, objectKind: "function block", name }));

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => { for (const app of apps.splice(0)) await app.close(); });

const removedRoutes = [
  "/api/v1/conventions/proposals",
  `/api/v1/conventions/${"a".repeat(64)}/decision`,
  `/api/v1/conventions/${"a".repeat(64)}/revisions`,
  `/api/v1/conventions/${"a".repeat(64)}/retirement`,
] as const;

describe("read-only convention HTTP routes", () => {
  it("exposes validated status and known history reads with explicit not-found behavior", async () => {
    const conventions = new ConventionService();
    const conventionId = conventions.propose({ examples })[0]!.conventionId;
    const app = buildApp({ conventions }); apps.push(app);
    expect((await app.inject({ method: "GET", url: "/api/v1/conventions" })).json()).toMatchObject({ proposed: [{ conventionId, authority: "inferred-convention", state: "proposed" }], active: [], rejected: [], retired: [] });
    expect((await app.inject({ method: "GET", url: `/api/v1/conventions/${conventionId}/history` })).json()).toMatchObject({ conventionId, draft: { conventionId }, decisions: [], revisions: [] });
    expect((await app.inject({ method: "GET", url: `/api/v1/conventions/${"a".repeat(64)}/history` })).statusCode).toBe(404);
  });

  it.each(removedRoutes)("does not register browser-reachable lifecycle route %s", async (url) => {
    const app = buildApp({ conventions: new ConventionService() }); apps.push(app);
    const response = await app.inject({ method: "POST", url, payload: {} });
    expect(response.statusCode).toBe(404);
  });
});
