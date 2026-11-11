import { createHash } from "node:crypto";

import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { engineeringSearchRequestSchema } from "@simon/contracts";
import { Type, type TObject } from "typebox";
import { z } from "zod";

import type { SnapshotBindingProvider, EngineeringSnapshotService } from "./engineering-snapshot.js";
import { EngineeringRetrievalService } from "./engineering-retrieval.js";
import type { InMemoryStore } from "./store.js";

export const ENGINEERING_SNAPSHOT_STATUS_TOOL = "simon_engineering_snapshot_status";
export const ENGINEERING_SEARCH_TOOL = "simon_engineering_search";
export const ENGINEERING_REFERENCES_TOOL = "simon_engineering_find_references";

const noParameters = Type.Object({}, { additionalProperties: false });
const searchParameters = Type.Object({
  query: Type.String({ minLength: 1, maxLength: 500 }),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  kinds: Type.Optional(Type.Array(Type.String(), { maxItems: 12 })),
}, { additionalProperties: false });
const referenceRequestSchema = z.object({
  symbol: z.string().trim().min(1).max(1_000),
  limit: z.number().int().min(1).max(100).default(20),
}).strict();
const referenceParameters = Type.Object({
  symbol: Type.String({ minLength: 1, maxLength: 1_000 }),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
}, { additionalProperties: false });

function digest(...parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("\0")).digest("hex");
}

export class EngineeringRetrievalToolProvider {
  constructor(
    private readonly engineering: SnapshotBindingProvider,
    private readonly snapshots: EngineeringSnapshotService,
    private readonly retrieval: EngineeringRetrievalService,
    private readonly store: InMemoryStore,
  ) {}

  createPiTools(conversationId: string): readonly ToolDefinition<TObject>[] {
    return [
      {
        name: ENGINEERING_SNAPSHOT_STATUS_TOOL,
        label: "Get engineering snapshot status",
        description: "Read the current conversation's engineering snapshot status, freshness, limits, and coverage. This tool cannot refresh or mutate the snapshot.",
        promptSnippet: "Check snapshot freshness and coverage before relying on engineering retrieval results.",
        promptGuidelines: [
          "Do not claim current project coverage when the snapshot is missing or stale.",
          "Disclose partial and unsupported coverage.",
        ],
        parameters: noParameters,
        execute: async () => {
          const status = this.#assertBound(conversationId);
          const persisted = this.store.getLatestEngineeringSnapshot(conversationId);
          const result = { binding: status.binding, snapshot: persisted };
          return { content: [{ type: "text", text: JSON.stringify(result) }], details: { engineeringSnapshotStatus: result } };
        },
      },
      {
        name: ENGINEERING_SEARCH_TOOL,
        label: "Search engineering snapshot",
        description: "Search the current immutable engineering snapshot by exact path, name, identifier, logical address, then bounded lexical fallback.",
        promptSnippet: "Search the bound snapshot and cite returned engineering paths and freshness.",
        promptGuidelines: [
          "Prefer exact engineering paths when names are ambiguous.",
          "Use only returned citations and disclose partial coverage.",
        ],
        parameters: searchParameters,
        execute: async (_toolCallId, params) => {
          const capture = this.#currentCapture(conversationId);
          const parsed = engineeringSearchRequestSchema.parse({
            query: params.query,
            limit: params.limit ?? 20,
            ...(params.kinds ? { kinds: params.kinds } : {}),
          });
          const result = this.retrieval.search(capture.snapshot, capture.records, parsed, this.store);
          return { content: [{ type: "text", text: JSON.stringify(result) }], details: { engineeringSearchResult: result } };
        },
      },
      {
        name: ENGINEERING_REFERENCES_TOOL,
        label: "Find engineering symbol references",
        description: "Find bounded exact symbol references from the current immutable engineering snapshot.",
        promptSnippet: "Use exact symbol references and cite the observed source engineering paths.",
        promptGuidelines: [
          "Do not infer references that are absent from the snapshot.",
          "Disclose snapshot freshness and reference coverage.",
        ],
        parameters: referenceParameters,
        execute: async (_toolCallId, params) => {
          const capture = this.#currentCapture(conversationId);
          const parsed = referenceRequestSchema.parse(params);
          const symbol = parsed.symbol;
          const limit = Math.min(parsed.limit, capture.snapshot.limits.maxResultsPerQuery);
          const references = capture.records.references
            .filter((reference) => reference.symbol.localeCompare(symbol, undefined, { sensitivity: "accent" }) === 0)
            .slice(0, limit)
            .map((reference) => ({
              ...reference,
              citation: {
                citationId: digest(capture.snapshot.snapshotId, reference.referenceId, reference.sourcePath),
                snapshotId: capture.snapshot.snapshotId,
                documentId: reference.referenceId,
                engineeringPath: reference.sourcePath,
                observedAt: reference.provenance.observedAt,
                freshness: capture.snapshot.freshness,
                coverage: reference.provenance.coverage,
              },
            }));
          const result = {
            snapshot: capture.snapshot,
            symbol,
            references,
            partial: capture.snapshot.state === "partial" || capture.snapshot.coverage.some((item) => item.state !== "complete"),
          };
          return { content: [{ type: "text", text: JSON.stringify(result) }], details: { engineeringReferenceResult: result } };
        },
      },
    ];
  }

  #assertBound(conversationId: string) {
    const status = this.engineering.getStatus(conversationId);
    if (status.state !== "connected" || !status.binding || !status.conversationBindingMatches) {
      throw new Error("A current conversation-scoped engineering binding is required for snapshot retrieval.");
    }
    return status;
  }

  #currentCapture(conversationId: string) {
    const status = this.#assertBound(conversationId);
    const capture = this.snapshots.getLatest(conversationId);
    const persisted = this.store.getLatestEngineeringSnapshot(conversationId);
    if (!capture?.records || !persisted || capture.snapshot.snapshotId !== persisted.snapshotId) {
      throw new Error("Create a current engineering snapshot before searching.");
    }
    if (persisted.freshness !== "current" || !["completed", "partial"].includes(persisted.state)) {
      throw new Error("The engineering snapshot is stale or incomplete; refresh it before searching.");
    }
    if (persisted.binding.bindingId !== status.binding?.bindingId || persisted.binding.epoch !== status.binding.epoch) {
      throw new Error("The engineering snapshot does not match the current conversation binding.");
    }
    return { snapshot: persisted, records: capture.records };
  }
}
