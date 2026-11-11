import { createHash } from "node:crypto";

import {
  engineeringDocumentSchema,
  engineeringReferenceSchema,
  plcTagTableSchema,
  type EngineeringDocument,
  type EngineeringProvenance,
  type EngineeringReference,
  type EngineeringSnapshot,
  type PlcTag,
  type PlcTagTable,
} from "@simon/contracts";

import type { SnapshotCollection } from "./engineering-snapshot.js";

export interface NormalizedEngineeringRecords {
  readonly documents: readonly EngineeringDocument[];
  readonly tagTables: readonly PlcTagTable[];
  readonly references: readonly EngineeringReference[];
}

const rawPathKeys = new Set(["projectpath", "exportpath", "artifactpath", "localpath", "snapshotpath", "workdirectory"]);

function digest(...parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("\0")).digest("hex");
}

function normalizeContent(content: string): string {
  const normalized = content.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trimEnd();
  if (!/^\s*<\?xml|^\s*<Document[\s>]/i.test(normalized)) return normalized;
  return normalized.replace(/<DocumentInfo\b[^>]*>[\s\S]*?<\/DocumentInfo>/i, "<DocumentInfo />");
}

function cleanOptional(value: string | null): string | null {
  const cleaned = value?.trim() ?? "";
  return cleaned ? cleaned : null;
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !rawPathKeys.has(key.toLowerCase()))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sanitizeValue(child)]),
  );
}

function provenance(
  snapshot: EngineeringSnapshot,
  sourceOperation: string,
  coverage: EngineeringProvenance["coverage"],
): EngineeringProvenance {
  return {
    snapshotId: snapshot.snapshotId,
    bindingId: snapshot.binding.bindingId,
    bindingEpoch: snapshot.binding.epoch,
    observedAt: snapshot.completedAt ?? snapshot.updatedAt,
    sourceOperation,
    coverage,
  };
}

export function normalizeEngineeringRecords(
  snapshot: EngineeringSnapshot,
  collection: SnapshotCollection,
): NormalizedEngineeringRecords {
  const documents = collection.documents.map((draft) => {
    const content = normalizeContent(draft.content);
    const contentDigest = digest(content);
    return engineeringDocumentSchema.parse({
      documentId: digest(snapshot.snapshotId, draft.kind, draft.engineeringPath, contentDigest),
      snapshotId: snapshot.snapshotId,
      kind: draft.kind,
      name: draft.name.trim(),
      engineeringPath: draft.engineeringPath.trim(),
      parentPath: cleanOptional(draft.parentPath),
      language: cleanOptional(draft.language),
      contentDigest,
      contentLength: Buffer.byteLength(content, "utf8"),
      artifactId: draft.artifactId,
      excerpt: content.slice(0, 2_000),
      attributes: sanitizeValue(draft.attributes),
      provenance: provenance(snapshot, draft.sourceOperation, draft.coverage),
    });
  }).sort((left, right) => left.engineeringPath.localeCompare(right.engineeringPath)
    || left.kind.localeCompare(right.kind)
    || left.name.localeCompare(right.name));

  const tagTables = collection.tagTables.map((table) => {
    const engineeringPath = table.engineeringPath.trim();
    const tags: PlcTag[] = table.tags.map((tag) => ({
      tagId: digest(snapshot.snapshotId, engineeringPath, tag.name.trim(), cleanOptional(tag.logicalAddress) ?? ""),
      snapshotId: snapshot.snapshotId,
      tablePath: engineeringPath,
      name: tag.name.trim(),
      dataType: cleanOptional(tag.dataType),
      logicalAddress: cleanOptional(tag.logicalAddress),
      comment: cleanOptional(tag.comment),
      provenance: provenance(snapshot, tag.sourceOperation, tag.coverage),
    })).sort((left, right) => left.name.localeCompare(right.name)
      || (left.logicalAddress ?? "").localeCompare(right.logicalAddress ?? ""));
    return plcTagTableSchema.parse({
      tableId: digest(snapshot.snapshotId, engineeringPath),
      snapshotId: snapshot.snapshotId,
      name: table.name.trim(),
      engineeringPath,
      tagCount: tags.length,
      tags,
      provenance: provenance(snapshot, table.sourceOperation, table.coverage),
    });
  }).sort((left, right) => left.engineeringPath.localeCompare(right.engineeringPath));

  const references = collection.references.map((reference) => engineeringReferenceSchema.parse({
    referenceId: digest(
      snapshot.snapshotId,
      reference.symbol.trim(),
      reference.sourcePath.trim(),
      cleanOptional(reference.targetPath) ?? "",
      reference.context.trim(),
    ),
    snapshotId: snapshot.snapshotId,
    symbol: reference.symbol.trim(),
    sourcePath: reference.sourcePath.trim(),
    targetPath: cleanOptional(reference.targetPath),
    context: reference.context.trim().slice(0, 2_000),
    provenance: provenance(snapshot, reference.sourceOperation, reference.coverage),
  })).sort((left, right) => left.symbol.localeCompare(right.symbol)
    || left.sourcePath.localeCompare(right.sourcePath)
    || (left.targetPath ?? "").localeCompare(right.targetPath ?? ""));

  return { documents, tagTables, references };
}
