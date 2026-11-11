import { randomUUID } from "node:crypto";

import {
  engineeringSnapshotSchema,
  type EngineeringCoverage,
  type EngineeringObjectKind,
  type EngineeringSnapshot,
  type EngineeringSnapshotLimits,
  type EngineeringStatus,
  type ProjectBinding,
} from "@simon/contracts";

import { normalizeEngineeringRecords, type NormalizedEngineeringRecords } from "./engineering-normalization.js";

export interface SnapshotBindingProvider {
  getStatus(conversationId?: string): EngineeringStatus;
}

export interface SnapshotDocumentDraft {
  readonly kind: EngineeringObjectKind;
  readonly name: string;
  readonly engineeringPath: string;
  readonly parentPath: string | null;
  readonly language: string | null;
  readonly content: string;
  readonly artifactId: string | null;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly sourceOperation: string;
  readonly coverage: EngineeringCoverage["state"];
}

export interface SnapshotTagDraft {
  readonly name: string;
  readonly dataType: string | null;
  readonly logicalAddress: string | null;
  readonly comment: string | null;
  readonly sourceOperation: string;
  readonly coverage: EngineeringCoverage["state"];
}

export interface SnapshotTagTableDraft {
  readonly name: string;
  readonly engineeringPath: string;
  readonly tags: readonly SnapshotTagDraft[];
  readonly sourceOperation: string;
  readonly coverage: EngineeringCoverage["state"];
}

export interface SnapshotReferenceDraft {
  readonly symbol: string;
  readonly sourcePath: string;
  readonly targetPath: string | null;
  readonly context: string;
  readonly sourceOperation: string;
  readonly coverage: EngineeringCoverage["state"];
}

export interface SnapshotCollection {
  readonly documents: readonly SnapshotDocumentDraft[];
  readonly tagTables: readonly SnapshotTagTableDraft[];
  readonly references: readonly SnapshotReferenceDraft[];
  readonly coverage: readonly EngineeringCoverage[];
}

export interface SnapshotCollectionRequest {
  readonly snapshotId: string;
  readonly conversationId: string;
  readonly binding: ProjectBinding;
  readonly forceRefresh: boolean;
  readonly limits: EngineeringSnapshotLimits;
  readonly resumeFrom: SnapshotCollection | null;
  readonly signal: AbortSignal;
}

export interface EngineeringSnapshotCollector {
  collect(request: SnapshotCollectionRequest): Promise<SnapshotCollection>;
}

export interface EngineeringSnapshotCapture {
  readonly snapshot: EngineeringSnapshot;
  readonly collection: SnapshotCollection;
  readonly records: NormalizedEngineeringRecords | null;
}

export interface EngineeringSnapshotRepository {
  saveEngineeringSnapshot(snapshot: EngineeringSnapshot): EngineeringSnapshot;
  indexEngineeringRecords?(snapshot: EngineeringSnapshot, records: NormalizedEngineeringRecords): void;
}

export class SnapshotCollectionInterrupted extends Error {
  constructor(readonly collection: SnapshotCollection, message = "Snapshot collection was interrupted.") {
    super(message);
    this.name = "SnapshotCollectionInterrupted";
  }
}

class SnapshotLimitExceeded extends Error {
  constructor(readonly collection: SnapshotCollection, message: string) {
    super(message);
    this.name = "SnapshotLimitExceeded";
  }
}

const defaultLimits: EngineeringSnapshotLimits = {
  maxObjects: 10_000,
  maxBytes: 50_000_000,
  maxDurationMs: 300_000,
  maxResultsPerQuery: 100,
};

const emptyCollection: SnapshotCollection = {
  documents: [],
  tagTables: [],
  references: [],
  coverage: [],
};

function collectionCounts(collection: SnapshotCollection): { objectCount: number; byteCount: number; documentCount: number } {
  return {
    objectCount: collection.documents.length
      + collection.tagTables.length
      + collection.tagTables.reduce((count, table) => count + table.tags.length, 0)
      + collection.references.length,
    byteCount: collection.documents.reduce((count, document) => count + Buffer.byteLength(document.content, "utf8"), 0),
    documentCount: collection.documents.length,
  };
}

function sameBinding(left: ProjectBinding, right: ProjectBinding): boolean {
  return left.bindingId === right.bindingId && left.epoch === right.epoch;
}

export class EngineeringSnapshotService {
  readonly #latestByConversation = new Map<string, EngineeringSnapshotCapture>();
  readonly #activeConversations = new Set<string>();

  constructor(
    private readonly engineering: SnapshotBindingProvider,
    private readonly collector: EngineeringSnapshotCollector,
    private readonly limits: EngineeringSnapshotLimits = defaultLimits,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = randomUUID,
    private readonly repository?: EngineeringSnapshotRepository,
  ) {}

  getLatest(conversationId: string): EngineeringSnapshotCapture | null {
    return this.#latestByConversation.get(conversationId) ?? null;
  }

  async create(conversationId: string, forceRefresh: boolean, signal: AbortSignal): Promise<EngineeringSnapshotCapture> {
    if (this.#activeConversations.has(conversationId)) throw new Error("A snapshot is already running for this conversation.");
    const status = this.engineering.getStatus(conversationId);
    if (status.state !== "connected" || !status.binding || !status.conversationBindingMatches) {
      throw new Error("A current conversation-scoped engineering binding is required to create a snapshot.");
    }

    const previous = this.#latestByConversation.get(conversationId) ?? null;
    const reusable = previous !== null && sameBinding(previous.snapshot.binding, status.binding);
    if (!forceRefresh && reusable && previous.snapshot.state === "completed" && previous.snapshot.freshness === "current") {
      return previous;
    }
    const resumable = !forceRefresh && reusable && ["partial", "interrupted"].includes(previous.snapshot.state)
      ? previous
      : null;
    const snapshotId = resumable?.snapshot.snapshotId ?? this.createId();
    const createdAt = resumable?.snapshot.createdAt ?? this.now().toISOString();
    const binding = status.binding;
    const startingCollection = resumable?.collection ?? emptyCollection;
    const startingCounts = collectionCounts(startingCollection);
    this.#record(conversationId, {
      snapshot: this.#snapshot({ snapshotId, conversationId, binding, state: "running", createdAt, ...startingCounts }),
      collection: startingCollection,
      records: resumable?.records ?? null,
    });

    this.#activeConversations.add(conversationId);
    const operationController = new AbortController();
    const abortOperation = () => operationController.abort(signal.reason);
    if (signal.aborted) abortOperation();
    else signal.addEventListener("abort", abortOperation, { once: true });
    const timeout = setTimeout(
      () => operationController.abort(new Error("Snapshot collection exceeded its duration limit.")),
      this.limits.maxDurationMs,
    );

    try {
      const collection = await this.collector.collect({
        snapshotId,
        conversationId,
        binding,
        forceRefresh,
        limits: this.limits,
        resumeFrom: resumable?.collection ?? null,
        signal: operationController.signal,
      });
      if (operationController.signal.aborted) {
        throw new SnapshotCollectionInterrupted(collection, "Snapshot collection was interrupted or timed out.");
      }
      const counts = collectionCounts(collection);
      if (counts.objectCount > this.limits.maxObjects) {
        throw new SnapshotLimitExceeded(collection, "Snapshot collection exceeded its object limit.");
      }
      if (counts.byteCount > this.limits.maxBytes) {
        throw new SnapshotLimitExceeded(collection, "Snapshot collection exceeded its byte limit.");
      }

      const current = this.engineering.getStatus(conversationId);
      if (!current.binding || !current.conversationBindingMatches || !sameBinding(current.binding, binding)) {
        throw new Error("The engineering binding changed while the snapshot was being collected.");
      }

      const completedAt = this.now().toISOString();
      const state = collection.coverage.some((item) => item.state !== "complete") ? "partial" : "completed";
      const capture = this.#terminalCapture({
        snapshotId,
        conversationId,
        binding,
        state,
        createdAt,
        completedAt,
        collection,
        coverage: collection.coverage,
      });
      this.#record(conversationId, capture);
      return capture;
    } catch (error) {
      const completedAt = this.now().toISOString();
      const partialCollection = error instanceof SnapshotCollectionInterrupted || error instanceof SnapshotLimitExceeded
        ? error.collection
        : startingCollection;
      const interrupted = operationController.signal.aborted || error instanceof SnapshotCollectionInterrupted;
      const limited = error instanceof SnapshotLimitExceeded;
      const coverage: readonly EngineeringCoverage[] = [
        ...partialCollection.coverage,
        {
          capability: "snapshot.collection",
          state: limited ? "partial" : "failed",
          observedCount: collectionCounts(partialCollection).objectCount,
          note: limited
            ? error.message
            : interrupted
              ? "Snapshot collection was interrupted. Partial observations may be resumed."
              : "Snapshot collection failed.",
        },
      ];
      const failed = this.#terminalCapture({
        snapshotId,
        conversationId,
        binding,
        state: limited ? "partial" : interrupted ? "interrupted" : "failed",
        createdAt,
        completedAt,
        collection: partialCollection,
        coverage,
      });
      this.#record(conversationId, failed);
      throw error;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abortOperation);
      this.#activeConversations.delete(conversationId);
    }
  }

  #record(conversationId: string, capture: EngineeringSnapshotCapture): void {
    this.#latestByConversation.set(conversationId, capture);
    this.repository?.saveEngineeringSnapshot(capture.snapshot);
    if (capture.records) this.repository?.indexEngineeringRecords?.(capture.snapshot, capture.records);
  }

  #terminalCapture(input: {
    readonly snapshotId: string;
    readonly conversationId: string;
    readonly binding: ProjectBinding;
    readonly state: EngineeringSnapshot["state"];
    readonly createdAt: string;
    readonly completedAt: string;
    readonly collection: SnapshotCollection;
    readonly coverage: readonly EngineeringCoverage[];
  }): EngineeringSnapshotCapture {
    const counts = collectionCounts(input.collection);
    const snapshot = engineeringSnapshotSchema.parse({
      snapshotId: input.snapshotId,
      conversationId: input.conversationId,
      binding: input.binding,
      state: input.state,
      freshness: "current",
      staleReason: null,
      createdAt: input.createdAt,
      updatedAt: input.completedAt,
      completedAt: input.completedAt,
      ...counts,
      limits: this.limits,
      coverage: input.coverage,
    });
    return {
      snapshot,
      collection: input.collection,
      records: normalizeEngineeringRecords(snapshot, input.collection),
    };
  }

  #snapshot(input: {
    readonly snapshotId: string;
    readonly conversationId: string;
    readonly binding: ProjectBinding;
    readonly state: EngineeringSnapshot["state"];
    readonly createdAt: string;
    readonly objectCount: number;
    readonly byteCount: number;
    readonly documentCount: number;
  }): EngineeringSnapshot {
    return engineeringSnapshotSchema.parse({
      snapshotId: input.snapshotId,
      conversationId: input.conversationId,
      binding: input.binding,
      state: input.state,
      freshness: "current",
      staleReason: null,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      completedAt: null,
      objectCount: input.objectCount,
      byteCount: input.byteCount,
      documentCount: input.documentCount,
      limits: this.limits,
      coverage: [],
    });
  }
}
