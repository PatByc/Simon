import { describe, expect, it } from "vitest";

import { inferNamingConventions, type AuthorizedConventionExample } from "./convention-inference.js";

const now = "2026-11-11T19:00:00.000Z";
function example(index: number, name: string, kind = "function block"): AuthorizedConventionExample {
  return { authorization: "host-authorized", evidenceId: index.toString(16).padStart(64, "0"), sourceId: "snapshot", citation: `PLC/Blocks/${name}`, excerpt: name, observedAt: now, objectKind: kind, name };
}

describe("inferNamingConventions", () => {
  it("proposes a repeated naming pattern with representative evidence and explicit exceptions", () => {
    const drafts = inferNamingConventions([
      example(1, "FB_Valve"), example(2, "FB_Pump"), example(3, "FB_Motor"), example(4, "FB_Conveyor"), example(5, "LegacyMixer"),
    ], now);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ state: "proposed", confidence: "medium", scope: ["function block"], exceptions: ["LegacyMixer does not use FB_."] });
    expect(drafts[0]!.evidence).toEqual(expect.arrayContaining([expect.objectContaining({ authority: "observed-project", citation: "PLC/Blocks/FB_Valve" })]));
    expect(drafts[0]!.rationale).toContain("host-authorized examples");
    expect(drafts[0]!.rationale).toContain("not an approved rule");
  });

  it("does not invent a convention below the repeat threshold", () => {
    expect(inferNamingConventions([example(1, "FB_One"), example(2, "FC_Two"), example(3, "DB_Three")], now)).toEqual([]);
    expect(inferNamingConventions([example(1, "FB_One"), example(2, "FB_Two")], now)).toEqual([]);
  });

  it("is deterministic and separates object-kind scopes", () => {
    const examples = [example(1, "FB_A"), example(2, "FB_B"), example(3, "FB_C"), example(4, "DB_A", "data block"), example(5, "DB_B", "data block"), example(6, "DB_C", "data block")];
    expect(inferNamingConventions(examples, now)).toEqual(inferNamingConventions([...examples].reverse(), now));
    expect(inferNamingConventions(examples, now).map((draft) => draft.scope[0])).toEqual(["data block", "function block"]);
  });

  it("rejects examples lacking an explicit host authorization marker", () => {
    const invalid = { ...example(1, "FB_A"), authorization: "model-selected" };
    expect(() => inferNamingConventions([invalid as unknown as AuthorizedConventionExample], now)).toThrow("host-authorized");
  });
});
