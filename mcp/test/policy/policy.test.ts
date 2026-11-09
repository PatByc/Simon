import { describe, expect, it } from "vitest";
import { assertProjectBinding, isReadEffect, mayExposeToModel } from "../../src/policy/index.js";

describe("engineering policy", () => {
  it("recognizes read effects", () => {
    expect(isReadEffect("status-read")).toBe(true);
    expect(isReadEffect("artifact-producing-read")).toBe(true);
    expect(isReadEffect("project-mutation")).toBe(false);
  });

  it("requires model exposure and an allowed operating mode", () => {
    expect(mayExposeToModel({ effect: "project-read", exposure: "model", allowedModes: ["tia-readonly"], requiresConnection: true, requiresProjectBinding: true, createsArtifacts: false, invalidatesContext: false, timeoutMs: 1_000 }, "tia-readonly")).toBe(true);
    expect(mayExposeToModel({ effect: "project-read", exposure: "blocked", allowedModes: ["tia-readonly"], requiresConnection: true, requiresProjectBinding: true, createsArtifacts: false, invalidatesContext: false, timeoutMs: 1_000 }, "tia-readonly")).toBe(false);
  });

  it("rejects a changed project binding", () => {
    expect(() => assertProjectBinding({ projectId: "a", name: "A", observedPathHash: "aaaaaaaa" }, { projectId: "b", name: "B", observedPathHash: "bbbbbbbb" })).toThrow(/no longer matches/);
  });
});
