import { createHash } from "node:crypto";

import {
  engineeringSearchRequestSchema,
  engineeringSearchResponseSchema,
  type EngineeringDocument,
  type EngineeringMatchKind,
  type EngineeringRetrievalHit,
  type EngineeringSearchRequest,
  type EngineeringSearchResponse,
  type EngineeringSnapshot,
} from "@simon/contracts";

import type { NormalizedEngineeringRecords } from "./engineering-normalization.js";

interface ExactCandidate {
  readonly document: EngineeringDocument;
  readonly path: string;
  readonly name: string;
  readonly logicalAddress: string | null;
  readonly identifiers: readonly string[];
}

export interface LexicalDocumentHit {
  readonly document: EngineeringDocument;
  readonly score: number;
  readonly snippet: string;
}

export interface EngineeringLexicalIndex {
  searchEngineeringDocuments(snapshotId: string, query: string, limit: number): readonly LexicalDocumentHit[];
}

const scores: Readonly<Record<Exclude<EngineeringMatchKind, "lexical">, number>> = {
  "exact-path": 100,
  "logical-address": 95,
  identifier: 90,
  "exact-name": 80,
};

function digest(...parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("\0")).digest("hex");
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function identifierValues(attributes: Readonly<Record<string, unknown>>): string[] {
  return Object.entries(attributes).flatMap(([key, value]) =>
    /^(id|identifier|constantname|number)$/i.test(key) && typeof value === "string" && value.trim()
      ? [value.trim()]
      : []);
}

function syntheticDocument(input: {
  readonly snapshot: EngineeringSnapshot;
  readonly documentId: string;
  readonly kind: EngineeringDocument["kind"];
  readonly name: string;
  readonly engineeringPath: string;
  readonly parentPath: string | null;
  readonly excerpt: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly provenance: EngineeringDocument["provenance"];
}): EngineeringDocument {
  const content = JSON.stringify(input.attributes);
  return {
    documentId: input.documentId,
    snapshotId: input.snapshot.snapshotId,
    kind: input.kind,
    name: input.name,
    engineeringPath: input.engineeringPath,
    parentPath: input.parentPath,
    language: null,
    contentDigest: digest(content),
    contentLength: Buffer.byteLength(content, "utf8"),
    artifactId: null,
    excerpt: input.excerpt.slice(0, 2_000),
    attributes: input.attributes,
    provenance: input.provenance,
  };
}

export function buildEngineeringSearchDocuments(
  snapshot: EngineeringSnapshot,
  records: NormalizedEngineeringRecords,
): readonly EngineeringDocument[] {
  const documents: EngineeringDocument[] = [...records.documents];
  for (const table of records.tagTables) {
    documents.push(syntheticDocument({
      snapshot,
      documentId: table.tableId,
      kind: "tag-table",
      name: table.name,
      engineeringPath: table.engineeringPath,
      parentPath: null,
      excerpt: `${table.name}: ${table.tagCount} PLC tags`,
      attributes: { tagCount: table.tagCount },
      provenance: table.provenance,
    }));
    for (const tag of table.tags) {
      documents.push(syntheticDocument({
        snapshot,
        documentId: tag.tagId,
        kind: "tag",
        name: tag.name,
        engineeringPath: `${table.engineeringPath}/${tag.name}`,
        parentPath: table.engineeringPath,
        excerpt: [tag.name, tag.dataType, tag.logicalAddress, tag.comment].filter(Boolean).join(" · "),
        attributes: { dataType: tag.dataType, logicalAddress: tag.logicalAddress, comment: tag.comment },
        provenance: tag.provenance,
      }));
    }
  }
  for (const reference of records.references) {
    documents.push(syntheticDocument({
      snapshot,
      documentId: reference.referenceId,
      kind: "reference",
      name: `${reference.symbol} reference`,
      engineeringPath: `${reference.sourcePath}#${reference.referenceId.slice(0, 12)}`,
      parentPath: reference.sourcePath,
      excerpt: reference.context || reference.symbol,
      attributes: { symbol: reference.symbol, targetPath: reference.targetPath },
      provenance: reference.provenance,
    }));
  }
  return documents.sort((left, right) => left.engineeringPath.localeCompare(right.engineeringPath)
    || left.kind.localeCompare(right.kind)
    || left.name.localeCompare(right.name));
}

export class AmbiguousEngineeringQueryError extends Error {
  constructor(readonly query: string, readonly engineeringPaths: readonly string[]) {
    super(`Engineering query '${query}' is ambiguous; use an exact engineering path.`);
    this.name = "AmbiguousEngineeringQueryError";
  }
}

export class EngineeringRetrievalService {
  search(
    snapshot: EngineeringSnapshot,
    records: NormalizedEngineeringRecords,
    requestValue: EngineeringSearchRequest,
    lexicalIndex: EngineeringLexicalIndex,
  ): EngineeringSearchResponse {
    const exact = this.searchExact(snapshot, records, requestValue);
    if (exact.hits.length > 0) return exact;
    const request = engineeringSearchRequestSchema.parse(requestValue);
    const allowedKinds = request.kinds ? new Set(request.kinds) : null;
    const limit = Math.min(request.limit, snapshot.limits.maxResultsPerQuery);
    const hits = lexicalIndex.searchEngineeringDocuments(snapshot.snapshotId, request.query, limit)
      .filter((item) => allowedKinds === null || allowedKinds.has(item.document.kind))
      .slice(0, limit)
      .map((item): EngineeringRetrievalHit => ({
        document: item.document,
        matchKind: "lexical",
        score: item.score,
        snippet: item.snippet,
        citation: {
          citationId: digest(snapshot.snapshotId, item.document.documentId, item.document.engineeringPath),
          snapshotId: snapshot.snapshotId,
          documentId: item.document.documentId,
          engineeringPath: item.document.engineeringPath,
          observedAt: item.document.provenance.observedAt,
          freshness: snapshot.freshness,
          coverage: item.document.provenance.coverage,
        },
      }));
    return engineeringSearchResponseSchema.parse({ ...exact, hits });
  }

  searchExact(
    snapshot: EngineeringSnapshot,
    records: NormalizedEngineeringRecords,
    requestValue: EngineeringSearchRequest,
  ): EngineeringSearchResponse {
    const request = engineeringSearchRequestSchema.parse(requestValue);
    if (snapshot.freshness !== "current" || !["completed", "partial"].includes(snapshot.state)) {
      throw new Error("Only a current completed or partial engineering snapshot can be searched.");
    }

    const allowedKinds = request.kinds ? new Set(request.kinds) : null;
    const candidates = buildEngineeringSearchDocuments(snapshot, records)
      .filter((document) => allowedKinds === null || allowedKinds.has(document.kind))
      .map((document): ExactCandidate => ({
        document,
        path: document.engineeringPath,
        name: document.name,
        logicalAddress: typeof document.attributes.logicalAddress === "string" ? document.attributes.logicalAddress : null,
        identifiers: identifierValues(document.attributes),
      }));
    const query = normalize(request.query);
    const stages: ReadonlyArray<{
      readonly kind: Exclude<EngineeringMatchKind, "lexical">;
      readonly matches: (candidate: ExactCandidate) => boolean;
    }> = [
      { kind: "exact-path", matches: (candidate) => normalize(candidate.path) === query },
      { kind: "logical-address", matches: (candidate) => candidate.logicalAddress !== null && normalize(candidate.logicalAddress) === query },
      { kind: "identifier", matches: (candidate) => candidate.identifiers.some((identifier) => normalize(identifier) === query) },
      { kind: "exact-name", matches: (candidate) => normalize(candidate.name) === query },
    ];

    let matchKind: Exclude<EngineeringMatchKind, "lexical"> | null = null;
    let matched: ExactCandidate[] = [];
    for (const stage of stages) {
      matched = candidates.filter(stage.matches);
      if (matched.length > 0) {
        matchKind = stage.kind;
        break;
      }
    }

    const uniquePaths = [...new Set(matched.map((candidate) => candidate.path))].sort((left, right) => left.localeCompare(right));
    if (matchKind !== "exact-path" && uniquePaths.length > 1) {
      throw new AmbiguousEngineeringQueryError(request.query, uniquePaths);
    }

    const hits: EngineeringRetrievalHit[] = matchKind === null ? [] : matched
      .sort((left, right) => left.path.localeCompare(right.path))
      .slice(0, Math.min(request.limit, snapshot.limits.maxResultsPerQuery))
      .map((candidate) => ({
        document: candidate.document,
        matchKind,
        score: scores[matchKind],
        snippet: candidate.document.excerpt.trim() || candidate.path,
        citation: {
          citationId: digest(snapshot.snapshotId, candidate.document.documentId, candidate.path),
          snapshotId: snapshot.snapshotId,
          documentId: candidate.document.documentId,
          engineeringPath: candidate.path,
          observedAt: candidate.document.provenance.observedAt,
          freshness: snapshot.freshness,
          coverage: candidate.document.provenance.coverage,
        },
      }));

    return engineeringSearchResponseSchema.parse({
      snapshot,
      query: request.query,
      hits,
      partial: snapshot.state === "partial" || snapshot.coverage.some((item) => item.state !== "complete"),
      coverage: snapshot.coverage,
    });
  }
}
