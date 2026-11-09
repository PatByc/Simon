import { createHash, randomUUID } from "node:crypto";
import type { ApprovalMode, Proposal, ProposalDecision } from "@simon/contracts";
import type { InMemoryStore } from "./store.js";

export class ProposalConflictError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

function digestProposalContent(proposal: Omit<Proposal, "contentDigest" | "status">): string {
  return createHash("sha256").update(JSON.stringify(proposal)).digest("hex");
}

export class ProposalService {
  constructor(private readonly store: InMemoryStore) {}

  createDemo(conversationId: string, approvalMode: ApprovalMode): Proposal {
    const now = new Date();
    const content = {
      proposalId: randomUUID(),
      conversationId,
      summary: "Preview a synthetic workspace preference change",
      actions: [
        {
          actionId: randomUUID(),
          operation: "preview",
          targetType: "demo.workspace-preference",
          targetId: null,
          description: "Demonstrate Simon's review workflow without changing an external system",
          fields: { density: "compact", navigation: "expanded" },
          effectClass: "synthetic" as const,
        },
      ],
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 60 * 1_000).toISOString(),
      synthetic: true,
    };
    const proposal: Proposal = {
      ...content,
      contentDigest: digestProposalContent(content),
      status: approvalMode === "auto" ? "applied" : "pending",
    };
    this.store.proposals.set(proposal.proposalId, proposal);
    return proposal;
  }

  decide(proposalId: string, decision: ProposalDecision): Proposal {
    const proposal = this.store.proposals.get(proposalId);
    if (!proposal) throw new ProposalConflictError("proposal_not_found", "Proposal not found");
    if (proposal.status !== "pending") {
      throw new ProposalConflictError("proposal_not_pending", "Proposal has already been decided");
    }
    if (new Date(proposal.expiresAt).getTime() <= Date.now()) {
      proposal.status = "expired";
      throw new ProposalConflictError("proposal_expired", "Proposal has expired");
    }
    if (decision.contentDigest !== proposal.contentDigest) {
      throw new ProposalConflictError("proposal_changed", "Proposal content no longer matches the reviewed version");
    }
    proposal.status = decision.decision === "approve" ? "applied" : "rejected";
    return proposal;
  }
}
