import { createHash, randomUUID } from "node:crypto";

import {
  approvedConventionSearchRequestSchema,
  approvedConventionSearchResponseSchema,
  conventionDecisionSchema,
  conventionDraftSchema,
  conventionProposalDecisionRequestSchema,
  conventionRevisionSchema,
  conventionStatusResponseSchema,
  createConventionProposalRequestSchema,
  retireConventionRequestSchema,
  reviseConventionRequestSchema,
  type ConventionDraft,
  type ConventionRevision,
  type ConventionStatusResponse,
  type CreateConventionProposalRequest,
} from "@simon/contracts";

import { inferNamingConventions } from "./convention-inference.js";
import { ConventionStore } from "./convention-store.js";

function digest(value: string): string { return createHash("sha256").update(value).digest("hex"); }

export class ConventionService {
  constructor(private readonly store = new ConventionStore()) {}

  propose(input: CreateConventionProposalRequest, now = new Date().toISOString()): readonly ConventionDraft[] {
    const parsed = createConventionProposalRequestSchema.parse(input);
    const drafts = inferNamingConventions(parsed.examples, now);
    for (const draft of drafts) {
      const latest = this.latest(draft.conventionId);
      if (!latest || latest.state !== "approved") this.store.appendDraft(conventionDraftSchema.parse(draft));
    }
    return drafts;
  }

  decide(conventionId: string, input: unknown, now = new Date().toISOString()): ConventionRevision | null {
    const request = conventionProposalDecisionRequestSchema.parse(input);
    const draft = this.pendingDraft(conventionId);
    const decision = conventionDecisionSchema.parse({ decisionId: randomUUID(), action: request.action, decidedAt: now, decidedBy: request.decidedBy, note: request.note, hostRecorded: true });
    this.store.appendDecision(conventionId, decision);
    if (request.action === "reject") return null;
    const revision = this.makeRevision({ draft, previous: null, revision: 1, state: "approved", decision, now });
    this.store.appendRevision(revision);
    return revision;
  }

  revise(conventionId: string, input: unknown, now = new Date().toISOString()): ConventionRevision {
    const request = reviseConventionRequestSchema.parse(input);
    const previous = this.requireActive(conventionId);
    const decision = conventionDecisionSchema.parse({ decisionId: randomUUID(), action: "supersede", decidedAt: now, decidedBy: request.decidedBy, note: request.note, hostRecorded: true });
    const draft: ConventionDraft = conventionDraftSchema.parse({ conventionId, state: "proposed", title: request.title, rule: request.rule, rationale: request.rationale, scope: request.scope, evidence: request.evidence, exceptions: request.exceptions, confidence: "high", createdAt: now, createdBy: "simon-inference" });
    this.store.appendDecision(conventionId, decision);
    const revision = this.makeRevision({ draft, previous, revision: previous.revision + 1, state: "approved", decision, now });
    this.store.appendRevision(revision);
    return revision;
  }

  retire(conventionId: string, input: unknown, now = new Date().toISOString()): ConventionRevision {
    const request = retireConventionRequestSchema.parse(input);
    const previous = this.requireActive(conventionId);
    const decision = conventionDecisionSchema.parse({ decisionId: randomUUID(), action: "retire", decidedAt: now, decidedBy: request.decidedBy, note: request.note, hostRecorded: true });
    this.store.appendDecision(conventionId, decision);
    const draft = conventionDraftSchema.parse({ conventionId, state: "proposed", title: previous.title, rule: previous.rule, rationale: previous.rationale, scope: previous.scope, evidence: previous.evidence, exceptions: previous.exceptions, confidence: "high", createdAt: now, createdBy: "simon-inference" });
    const revision = this.makeRevision({ draft, previous, revision: previous.revision + 1, state: "retired", decision, now });
    this.store.appendRevision(revision);
    return revision;
  }

  history(conventionId: string): { readonly draft: ConventionDraft | null; readonly decisions: ReturnType<ConventionStore["listDecisions"]>; readonly revisions: readonly ConventionRevision[] } {
    return { draft: this.store.getDraft(conventionId), decisions: this.store.listDecisions(conventionId), revisions: this.store.listRevisions(conventionId) };
  }

  searchApproved(input: unknown) {
    const request = approvedConventionSearchRequestSchema.parse(input);
    const query = request.query.toLocaleLowerCase("en-US");
    const hits = this.status().active.flatMap((revision) => {
      const exact = [revision.title, revision.rule, ...revision.scope].some((value) => value.toLocaleLowerCase("en-US") === query);
      const content = `${revision.title}\n${revision.rule}\n${revision.rationale}\n${revision.scope.join(" ")}\n${revision.exceptions.join(" ")}`;
      const lexical = content.toLocaleLowerCase("en-US").includes(query);
      return exact || lexical ? [{ authority: "approved-convention" as const, revision, score: exact ? 100 : 1, snippet: revision.rule.slice(0, 2_000) }] : [];
    }).sort((a, b) => b.score - a.score || a.revision.revisionId.localeCompare(b.revision.revisionId)).slice(0, request.limit);
    return approvedConventionSearchResponseSchema.parse({ query: request.query, hits });
  }

  status(): ConventionStatusResponse {
    const decided = new Set(this.store.listDecisions().filter(({ decision }) => decision.action === "approve" || decision.action === "reject").map(({ conventionId }) => conventionId));
    const latest = new Map<string, ConventionRevision>();
    for (const revision of this.store.listRevisions()) latest.set(revision.conventionId, revision);
    return conventionStatusResponseSchema.parse({
      proposed: this.store.listDrafts().filter((draft) => !decided.has(draft.conventionId)),
      active: [...latest.values()].filter((revision) => revision.state === "approved"),
      retired: [...latest.values()].filter((revision) => revision.state === "retired" || revision.state === "superseded"),
      rejectedCount: this.store.listDecisions().filter(({ decision }) => decision.action === "reject").length,
    });
  }

  private pendingDraft(conventionId: string): ConventionDraft {
    const draft = this.store.getDraft(conventionId);
    if (!draft || this.store.listDecisions(conventionId).some(({ decision }) => decision.action === "approve" || decision.action === "reject")) throw new Error("Convention proposal was not found or has already been decided.");
    return draft;
  }

  private latest(conventionId: string): ConventionRevision | null { return this.store.listRevisions(conventionId).at(-1) ?? null; }
  private requireActive(conventionId: string): ConventionRevision {
    const latest = this.latest(conventionId);
    if (!latest || latest.state !== "approved") throw new Error("An active convention revision is required.");
    return latest;
  }

  private makeRevision(input: { draft: ConventionDraft; previous: ConventionRevision | null; revision: number; state: ConventionRevision["state"]; decision: ConventionRevision["decision"]; now: string }): ConventionRevision {
    return conventionRevisionSchema.parse({
      revisionId: digest(JSON.stringify({ conventionId: input.draft.conventionId, revision: input.revision, draft: input.draft, decision: input.decision, state: input.state })),
      conventionId: input.draft.conventionId, revision: input.revision, state: input.state,
      title: input.draft.title, rule: input.draft.rule, rationale: input.draft.rationale, scope: input.draft.scope,
      evidence: input.draft.evidence, exceptions: input.draft.exceptions, approvedAt: input.now, decision: input.decision,
      supersedesRevisionId: input.previous?.revisionId ?? null,
    });
  }
}
