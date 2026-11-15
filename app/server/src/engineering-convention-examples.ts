import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import {
  authorizedConventionExampleSchema,
  engineeringDocumentSchema,
  engineeringSnapshotSchema,
  type AuthorizedConventionExamplePayload,
  type EngineeringStatus,
} from "@simon/contracts";

interface SnapshotRow { readonly snapshot_json: string }
interface DocumentRow { readonly document_json: string }

export interface ConventionExampleSource {
  load(conversationId: string): Promise<readonly AuthorizedConventionExamplePayload[]>;
}

export class EngineeringSnapshotConventionExampleSource implements ConventionExampleSource {
  constructor(
    private readonly databasePath: string,
    private readonly getStatus: (conversationId: string) => Promise<EngineeringStatus>,
  ) {}

  async load(conversationId: string): Promise<readonly AuthorizedConventionExamplePayload[]> {
    const status = await this.getStatus(conversationId);
    if (status.state !== "connected" || !status.binding || !status.conversationBindingMatches) {
      throw new Error("A current conversation-scoped engineering binding is required for convention inference.");
    }
    const database = new DatabaseSync(this.databasePath, { readOnly: true });
    try {
      const row = database.prepare("SELECT snapshot_json FROM engineering_snapshots WHERE conversation_id = ? ORDER BY updated_at DESC LIMIT 1").get(conversationId) as unknown as SnapshotRow | undefined;
      if (!row) throw new Error("A current engineering snapshot is required for convention inference.");
      const snapshot = engineeringSnapshotSchema.parse(JSON.parse(row.snapshot_json));
      if (snapshot.freshness !== "current" || !["completed", "partial"].includes(snapshot.state)) {
        throw new Error("The engineering snapshot must be current before convention inference.");
      }
      if (snapshot.binding.bindingId !== status.binding.bindingId || snapshot.binding.epoch !== status.binding.epoch) {
        throw new Error("The engineering snapshot does not match the current conversation binding.");
      }
      const rows = database.prepare("SELECT document_json FROM engineering_documents WHERE snapshot_id = ? ORDER BY engineering_path LIMIT 500").all(snapshot.snapshotId) as unknown as DocumentRow[];
      if (rows.length === 0) throw new Error("The current engineering snapshot has no authorized convention examples.");
      return rows.map((entry) => {
        const document = engineeringDocumentSchema.parse(JSON.parse(entry.document_json));
        return authorizedConventionExampleSchema.parse({
          authorization: "host-authorized",
          evidenceId: createHash("sha256").update([snapshot.snapshotId, document.documentId, document.engineeringPath].join("\0")).digest("hex"),
          sourceId: snapshot.snapshotId,
          citation: document.engineeringPath,
          excerpt: document.name,
          observedAt: snapshot.updatedAt,
          objectKind: document.kind,
          name: document.name,
        });
      });
    } finally {
      database.close();
    }
  }
}
