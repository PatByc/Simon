import { z } from "zod";

import { ConventionService } from "./convention-service.js";
import type { ConventionExampleSource } from "./engineering-convention-examples.js";

const conventionIdSchema = z.string().regex(/^[a-f0-9]{64}$/);
const actorSchema = z.string().trim().min(1).max(200);
const noteSchema = z.string().trim().min(1).max(2_000);
const boundedText = z.string().trim().min(1).max(4_000);
const boundedList = z.array(z.string().trim().min(1).max(1_000)).max(100);

export const conventionAdminCommandSchema = z.discriminatedUnion("command", [
  z.object({ command: z.literal("status") }).strict(),
  z.object({ command: z.literal("history"), conventionId: conventionIdSchema }).strict(),
  z.object({ command: z.literal("infer"), conversationId: z.string().uuid(), confirmed: z.literal(true) }).strict(),
  z.object({ command: z.enum(["approve", "reject"]), conventionId: conventionIdSchema, actor: actorSchema, note: noteSchema, confirmed: z.literal(true) }).strict(),
  z.object({
    command: z.literal("revise"), conventionId: conventionIdSchema, actor: actorSchema, note: noteSchema, confirmed: z.literal(true),
    title: boundedText.optional(), rule: boundedText.optional(), rationale: boundedText.optional(), scope: boundedList.optional(), exceptions: boundedList.optional(),
  }).strict(),
  z.object({ command: z.literal("retire"), conventionId: conventionIdSchema, actor: actorSchema, note: noteSchema, confirmed: z.literal(true) }).strict(),
]);

export type ConventionAdminCommand = z.infer<typeof conventionAdminCommandSchema>;

export class ConventionAdmin {
  constructor(
    private readonly conventions: ConventionService,
    private readonly examples?: ConventionExampleSource,
  ) {}

  async execute(input: unknown): Promise<unknown> {
    const request = conventionAdminCommandSchema.parse(input);
    if (request.command === "status") return this.conventions.status();
    if (request.command === "history") return this.requireHistory(request.conventionId);
    if (request.command === "infer") {
      if (!this.examples) throw new Error("Convention inference source is unavailable.");
      return { proposals: this.conventions.propose({ examples: [...await this.examples.load(request.conversationId)] }) };
    }
    if (request.command === "approve" || request.command === "reject") {
      return { revision: this.conventions.decide(request.conventionId, { action: request.command, decidedBy: request.actor, note: request.note }) };
    }
    if (request.command === "retire") {
      return this.conventions.retire(request.conventionId, { decidedBy: request.actor, note: request.note });
    }
    if (request.command !== "revise") throw new Error("Unsupported convention administration command.");
    const history = this.requireHistory(request.conventionId);
    const previous = history.revisions.at(-1);
    if (!previous || previous.state !== "approved") throw new Error("An active convention revision is required.");
    return this.conventions.revise(request.conventionId, {
      title: request.title ?? previous.title,
      rule: request.rule ?? previous.rule,
      rationale: request.rationale ?? previous.rationale,
      scope: request.scope ?? previous.scope,
      evidence: previous.evidence,
      exceptions: request.exceptions ?? previous.exceptions,
      decidedBy: request.actor,
      note: request.note,
    });
  }

  private requireHistory(conventionId: string) {
    const history = this.conventions.history(conventionId);
    if (!history.draft && history.decisions.length === 0 && history.revisions.length === 0) throw new Error("Convention was not found.");
    return history;
  }
}
