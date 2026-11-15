import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { EngineeringSnapshot } from "@simon/contracts";

import { EngineeringSnapshotConventionExampleSource } from "./engineering-convention-examples.js";
import { normalizeEngineeringRecords } from "./engineering-normalization.js";
import { InMemoryStore } from "./store.js";
import { fixtureBinding, fixtureCollection, fixtureSnapshot } from "./testing/engineering-fixture.js";

const dirs: string[] = [];
const stores: InMemoryStore[] = [];
afterEach(() => { for (const store of stores.splice(0)) store.close(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "simon-convention-examples-")); dirs.push(dir);
  const databasePath = join(dir, "simon.sqlite");
  const store = new InMemoryStore(databasePath); stores.push(store);
  const conversation = store.createConversation({ title: "Convention source", approvalMode: "manual" });
  const snapshot: EngineeringSnapshot = { ...fixtureSnapshot, conversationId: conversation.conversationId };
  store.saveEngineeringSnapshot(snapshot);
  store.indexEngineeringRecords(snapshot, normalizeEngineeringRecords(snapshot, fixtureCollection));
  const connectedStatus = {
    mode: "tia-readonly" as const, state: "connected" as const, binding: fixtureBinding,
    conversationBindingMatches: true, observedAt: snapshot.updatedAt,
  };
  return { databasePath, snapshot, connectedStatus };
}

describe("engineering snapshot convention examples", () => {
  it("derives bounded host-authorized examples from a current matching Simon snapshot", async () => {
    const { databasePath, snapshot, connectedStatus } = setup();
    const source = new EngineeringSnapshotConventionExampleSource(databasePath, async () => connectedStatus);
    const examples = await source.load(snapshot.conversationId);
    expect(examples.length).toBeGreaterThan(2);
    expect(examples.every((example) => example.authorization === "host-authorized" && example.sourceId === snapshot.snapshotId)).toBe(true);
    expect(examples.map((example) => example.citation)).toContain("Program blocks/Main");
    expect(examples.every((example) => !example.excerpt.includes("restart delay"))).toBe(true);
  });

  it("fails closed for unbound or mismatched evidence", async () => {
    const { databasePath, snapshot, connectedStatus } = setup();
    const unbound = new EngineeringSnapshotConventionExampleSource(databasePath, async () => ({ ...connectedStatus, state: "disconnected" as const, binding: null, conversationBindingMatches: false }));
    await expect(unbound.load(snapshot.conversationId)).rejects.toThrow("current conversation-scoped engineering binding");
    const mismatch = new EngineeringSnapshotConventionExampleSource(databasePath, async () => ({ ...connectedStatus, binding: { ...fixtureBinding, epoch: "55555555-5555-4555-8555-555555555555" } }));
    await expect(mismatch.load(snapshot.conversationId)).rejects.toThrow("does not match");
  });
});
