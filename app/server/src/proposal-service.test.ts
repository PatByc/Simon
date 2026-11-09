import { describe, expect, it } from "vitest";
import { ProposalConflictError, ProposalService } from "./proposal-service.js";
import { InMemoryStore } from "./store.js";

function setup(mode: "manual" | "auto" = "manual") {
  const store = new InMemoryStore();
  const conversation = store.createConversation({ title: undefined, approvalMode: mode });
  return { store, service: new ProposalService(store), conversation };
}

describe("ProposalService", () => {
  it("creates a pending immutable proposal in manual mode", () => {
    const { service, conversation } = setup();
    const proposal = service.createDemo(conversation.conversationId, "manual");

    expect(proposal.status).toBe("pending");
    expect(proposal.synthetic).toBe(true);
    expect(proposal.contentDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("applies a safe synthetic proposal immediately in auto mode", () => {
    const { service, conversation } = setup("auto");
    expect(service.createDemo(conversation.conversationId, "auto").status).toBe("applied");
  });

  it("rejects changed and duplicate decisions", () => {
    const { service, conversation } = setup();
    const proposal = service.createDemo(conversation.conversationId, "manual");

    expect(() =>
      service.decide(proposal.proposalId, { decision: "approve", contentDigest: "0".repeat(64) }),
    ).toThrowError(ProposalConflictError);

    service.decide(proposal.proposalId, {
      decision: "approve",
      contentDigest: proposal.contentDigest,
    });
    expect(() =>
      service.decide(proposal.proposalId, {
        decision: "approve",
        contentDigest: proposal.contentDigest,
      }),
    ).toThrowError(/already been decided/);
  });
});
