import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { AuthorizedConventionExamplePayload } from "@simon/contracts";

import { ConventionAdmin, conventionAdminCommandSchema } from "./convention-admin.js";
import { parseConventionAdminArgs } from "./convention-admin-cli.js";
import { ConventionService } from "./convention-service.js";
import { ConventionStore } from "./convention-store.js";

const id = "a".repeat(64);
const firstConversation = "11111111-1111-4111-8111-111111111111";
const secondConversation = "22222222-2222-4222-8222-222222222222";
const dirs: string[] = [];
const stores: ConventionStore[] = [];
afterEach(() => { for (const store of stores.splice(0)) store.close(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function examples(prefix: string, sourceId: string): AuthorizedConventionExamplePayload[] {
  return [`${prefix}Valve`, `${prefix}Pump`, `${prefix}Motor`, "LegacyMixer"].map((name, index) => ({
    authorization: "host-authorized", evidenceId: (index + 1).toString(16).padStart(64, "0"), sourceId,
    citation: `PLC/Program blocks/${name}`, excerpt: name, observedAt: "2026-11-11T20:00:00.000Z", objectKind: "function block", name,
  }));
}

describe("convention host administration input boundary", () => {
  it("accepts read commands without mutation confirmation", () => {
    expect(parseConventionAdminArgs(["status"])).toEqual({ command: "status" });
    expect(parseConventionAdminArgs(["history", "--convention-id", id])).toEqual({ command: "history", conventionId: id });
  });

  it("requires explicit actor, note, and confirmation for mutations", () => {
    expect(() => parseConventionAdminArgs(["approve", "--convention-id", id, "--actor", "engineer", "--note", "Approved."])).toThrow("--confirm");
    expect(() => parseConventionAdminArgs(["approve", "--convention-id", id, "--note", "Approved.", "--confirm"])).toThrow("--actor");
    expect(parseConventionAdminArgs(["reject", "--convention-id", id, "--actor", "engineer", "--note", "Not applicable.", "--confirm"])).toMatchObject({ command: "reject", confirmed: true });
    expect(parseConventionAdminArgs(["infer", "--conversation-id", firstConversation, "--confirm"])).toEqual({ command: "infer", conversationId: firstConversation, confirmed: true });
  });

  it("rejects arbitrary paths, URLs, SQL options, unknown commands, and duplicate scalar options", () => {
    for (const option of ["--database", "--file", "--url", "--sql", "--script"]) {
      expect(() => parseConventionAdminArgs(["history", "--convention-id", id, option, "value"])).toThrow("Unknown option");
    }
    expect(() => parseConventionAdminArgs(["activate", "--convention-id", id])).toThrow("Command must be one of");
    expect(() => parseConventionAdminArgs(["approve", "--convention-id", id, "--convention-id", id, "--actor", "engineer", "--note", "Approved.", "--confirm"])).toThrow("only once");
  });

  it("runtime-validates opaque IDs and bounded actor/note/content fields", () => {
    expect(() => conventionAdminCommandSchema.parse({ command: "history", conventionId: "not-an-id" })).toThrow();
    expect(() => conventionAdminCommandSchema.parse({ command: "approve", conventionId: id, actor: "", note: "Approved.", confirmed: true })).toThrow();
    expect(() => conventionAdminCommandSchema.parse({ command: "approve", conventionId: id, actor: "engineer", note: "x".repeat(2_001), confirmed: true })).toThrow();
    expect(() => conventionAdminCommandSchema.parse({ command: "revise", conventionId: id, actor: "engineer", note: "Clarified.", confirmed: true, rule: "x".repeat(4_001) })).toThrow();
  });

  it("runs infer, reject, approve, revise, retire, and restart persistence through direct service calls", async () => {
    const dir = mkdtempSync(join(tmpdir(), "simon-convention-admin-")); dirs.push(dir);
    const path = join(dir, "conventions.sqlite");
    const store = new ConventionStore(path); stores.push(store);
    const source = { load: async (conversationId: string) => conversationId === firstConversation ? examples("FB_", "snapshot-a") : examples("FC_", "snapshot-b") };
    const admin = new ConventionAdmin(new ConventionService(store), source);

    await admin.execute({ command: "infer", conversationId: firstConversation, confirmed: true });
    await admin.execute({ command: "infer", conversationId: secondConversation, confirmed: true });
    const proposed = await admin.execute({ command: "status" }) as ReturnType<ConventionService["status"]>;
    expect(proposed.proposed).toHaveLength(2);
    const approveId = proposed.proposed.find((draft) => draft.rule.includes("FB_"))!.conventionId;
    const rejectId = proposed.proposed.find((draft) => draft.rule.includes("FC_"))!.conventionId;

    await admin.execute({ command: "reject", conventionId: rejectId, actor: "qualification-engineer", note: "Rejected in host flow.", confirmed: true });
    const approved = await admin.execute({ command: "approve", conventionId: approveId, actor: "qualification-engineer", note: "Approved in host flow.", confirmed: true }) as { revision: { revisionId: string; evidence: readonly unknown[] } };
    await expect(admin.execute({ command: "approve", conventionId: approveId, actor: "qualification-engineer", note: "Duplicate.", confirmed: true })).rejects.toThrow("already been decided");
    const revised = await admin.execute({ command: "revise", conventionId: approveId, actor: "qualification-engineer", note: "Clarified.", confirmed: true, exceptions: ["Vendor blocks."] }) as { revision: number; evidence: readonly unknown[]; supersedesRevisionId: string | null };
    expect(revised).toMatchObject({ revision: 2, supersedesRevisionId: approved.revision.revisionId });
    expect(revised.evidence).toEqual(approved.revision.evidence);
    expect(await admin.execute({ command: "retire", conventionId: approveId, actor: "qualification-engineer", note: "Retired after qualification.", confirmed: true })).toMatchObject({ revision: 3, state: "retired" });
    await expect(admin.execute({ command: "history", conventionId: "f".repeat(64) })).rejects.toThrow("not found");

    store.close(); stores.splice(stores.indexOf(store), 1);
    const reopened = new ConventionStore(path); stores.push(reopened);
    expect(new ConventionService(reopened).status()).toMatchObject({ proposed: [], active: [], retired: [{ revision: 3, state: "retired" }], rejectedCount: 1 });
  });
});
