import { describe, expect, it } from "vitest";

import { engineeringSnapshotSchema } from "@simon/contracts";
import { normalizeEngineeringRecords } from "../engineering-normalization.js";
import { fixtureCollection, fixtureSnapshot, staleFixtureSnapshot } from "./engineering-fixture.js";

describe("deterministic engineering fixture", () => {
  it("covers source formats, duplicate names, tags, references, partial coverage, and stale state", () => {
    expect(engineeringSnapshotSchema.parse(fixtureSnapshot)).toEqual(fixtureSnapshot);
    expect(fixtureCollection.documents.map((item) => item.language)).toEqual(["SCL", "FBD", "LAD"]);
    expect(fixtureCollection.documents.filter((item) => item.name === "Pump")).toHaveLength(2);
    expect(fixtureCollection.tagTables.flatMap((table) => table.tags).filter((tag) => tag.name === "Ready")).toHaveLength(2);
    expect(fixtureCollection.references).toHaveLength(1);
    expect(fixtureSnapshot.coverage.some((item) => item.state === "partial")).toBe(true);
    expect(staleFixtureSnapshot()).toMatchObject({ state: "stale", freshness: "stale" });
  });

  it("normalizes identically on repeated runs", () => {
    expect(normalizeEngineeringRecords(fixtureSnapshot, fixtureCollection))
      .toEqual(normalizeEngineeringRecords(fixtureSnapshot, fixtureCollection));
  });
});
