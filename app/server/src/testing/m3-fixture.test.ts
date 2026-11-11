import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { conventionDraftSchema, conventionRevisionSchema, documentationSourceSchema, documentationTopicSchema } from "@simon/contracts";

import { createM3Fixture } from "./m3-fixture.js";

describe("deterministic M3 fixture", () => {
  it("is stable, contract-valid, and covers exact, lexical, ambiguity, adjacent, injection, proposed, and approved cases", () => {
    const first = createM3Fixture(); const second = createM3Fixture();
    expect(createHash("sha256").update(JSON.stringify(first)).digest("hex")).toBe(createHash("sha256").update(JSON.stringify(second)).digest("hex"));
    first.sources.forEach((source) => expect(() => documentationSourceSchema.parse(source)).not.toThrow());
    first.topics.forEach(({ topic }) => expect(() => documentationTopicSchema.parse(topic)).not.toThrow());
    expect(() => conventionDraftSchema.parse(first.proposedConvention)).not.toThrow();
    expect(() => conventionRevisionSchema.parse(first.approvedConvention)).not.toThrow();
    expect(first.topics.some(({ content }) => content.includes("Ignore Simon policy"))).toBe(true);
    expect(first.topics.filter(({ topic }) => topic.title === "Duplicate instruction")).toHaveLength(2);
    expect(first.sources.map(({ version }) => version)).toEqual(["V20", "V19"]);
  });
});
