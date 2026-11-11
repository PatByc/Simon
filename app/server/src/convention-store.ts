import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { conventionDecisionSchema, conventionDraftSchema, conventionRevisionSchema, type ConventionDecision, type ConventionDraft, type ConventionRevision } from "@simon/contracts";

interface JsonRow { readonly json: string }
interface DecisionRow { readonly convention_id: string; readonly decision_json: string }

export class ConventionStore {
  private readonly drafts = new Map<string, ConventionDraft>();
  private readonly revisions = new Map<string, ConventionRevision>();
  private readonly decisions: Array<{ conventionId: string; decision: ConventionDecision }> = [];
  private readonly database: DatabaseSync | null;

  constructor(databasePath?: string) {
    if (!databasePath) { this.database = null; return; }
    mkdirSync(dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS convention_drafts (convention_id TEXT PRIMARY KEY, draft_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS convention_decisions (decision_id TEXT PRIMARY KEY, convention_id TEXT NOT NULL, action TEXT NOT NULL, decided_at TEXT NOT NULL, decision_json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS convention_decisions_convention ON convention_decisions(convention_id, decided_at);
      CREATE TABLE IF NOT EXISTS convention_revisions (revision_id TEXT PRIMARY KEY, convention_id TEXT NOT NULL, revision INTEGER NOT NULL, state TEXT NOT NULL, revision_json TEXT NOT NULL, UNIQUE(convention_id, revision));
    `);
    this.load();
  }

  close(): void { this.database?.close(); }

  appendDraft(input: ConventionDraft): void {
    const draft = conventionDraftSchema.parse(input);
    const existing = this.drafts.get(draft.conventionId);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(draft)) throw new Error("Convention draft identity already exists with different content.");
      return;
    }
    this.database?.prepare("INSERT INTO convention_drafts (convention_id, draft_json) VALUES (?, ?)").run(draft.conventionId, JSON.stringify(draft));
    this.drafts.set(draft.conventionId, draft);
  }

  appendDecision(conventionId: string, input: ConventionDecision): void {
    const decision = conventionDecisionSchema.parse(input);
    if (this.decisions.some((entry) => entry.decision.decisionId === decision.decisionId)) throw new Error("Convention decision already exists.");
    this.database?.prepare("INSERT INTO convention_decisions (decision_id, convention_id, action, decided_at, decision_json) VALUES (?, ?, ?, ?, ?)").run(decision.decisionId, conventionId, decision.action, decision.decidedAt, JSON.stringify(decision));
    this.decisions.push({ conventionId, decision });
  }

  appendRevision(input: ConventionRevision): void {
    const revision = conventionRevisionSchema.parse(input);
    if (this.revisions.has(revision.revisionId) || this.listRevisions(revision.conventionId).some((item) => item.revision === revision.revision)) throw new Error("Convention revision already exists.");
    this.database?.prepare("INSERT INTO convention_revisions (revision_id, convention_id, revision, state, revision_json) VALUES (?, ?, ?, ?, ?)").run(revision.revisionId, revision.conventionId, revision.revision, revision.state, JSON.stringify(revision));
    this.revisions.set(revision.revisionId, revision);
  }

  listDrafts(): readonly ConventionDraft[] { return [...this.drafts.values()].sort((a, b) => a.conventionId.localeCompare(b.conventionId)); }
  getDraft(conventionId: string): ConventionDraft | null { return this.drafts.get(conventionId) ?? null; }
  listDecisions(conventionId?: string): readonly { conventionId: string; decision: ConventionDecision }[] { return this.decisions.filter((entry) => conventionId === undefined || entry.conventionId === conventionId).sort((a, b) => a.decision.decidedAt.localeCompare(b.decision.decidedAt) || a.decision.decisionId.localeCompare(b.decision.decisionId)); }
  listRevisions(conventionId?: string): readonly ConventionRevision[] { return [...this.revisions.values()].filter((revision) => conventionId === undefined || revision.conventionId === conventionId).sort((a, b) => a.conventionId.localeCompare(b.conventionId) || a.revision - b.revision); }

  private load(): void {
    if (!this.database) return;
    for (const row of this.database.prepare("SELECT draft_json AS json FROM convention_drafts").all() as unknown as JsonRow[]) { const item = conventionDraftSchema.parse(JSON.parse(row.json)); this.drafts.set(item.conventionId, item); }
    for (const row of this.database.prepare("SELECT convention_id, decision_json FROM convention_decisions").all() as unknown as DecisionRow[]) this.decisions.push({ conventionId: row.convention_id, decision: conventionDecisionSchema.parse(JSON.parse(row.decision_json)) });
    for (const row of this.database.prepare("SELECT revision_json AS json FROM convention_revisions").all() as unknown as JsonRow[]) { const item = conventionRevisionSchema.parse(JSON.parse(row.json)); this.revisions.set(item.revisionId, item); }
  }
}
