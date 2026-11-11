import { createHash } from "node:crypto";

import {
  documentationSearchRequestSchema,
  documentationSearchResponseSchema,
  documentationStatusResponseSchema,
  type DocumentationApplicability,
  type DocumentationMatchKind,
  type DocumentationRetrievalHit,
  type DocumentationSearchRequest,
  type DocumentationSearchResponse,
  type DocumentationSource,
  type DocumentationStatusResponse,
  type DocumentationTarget,
  type DocumentationTopic,
} from "@simon/contracts";

import { deriveDocumentationApplicability } from "./documentation-applicability.js";
import { DocumentationStore, type StoredDocumentationTopic } from "./documentation-store.js";

export class DocumentationAmbiguityError extends Error {
  constructor(readonly candidates: readonly { sourceId: string; topicId: string; title: string; version: string | null; update: string | null }[]) {
    super("Documentation query is ambiguous; specify an exact topic key, source, version, or update.");
  }
}

function digest(...parts: readonly string[]): string { return createHash("sha256").update(parts.join("\0")).digest("hex"); }
function normalize(value: string): string { return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " "); }

function candidateCpu(topic: DocumentationTopic, target: DocumentationTarget): string | null {
  const values = Array.isArray(topic.attributes.cpuFamilies)
    ? topic.attributes.cpuFamilies.filter((value): value is string => typeof value === "string") : [];
  if (target.cpuFamily && values.some((value) => normalize(value) === normalize(target.cpuFamily!))) return target.cpuFamily;
  return values.length === 1 ? values[0]! : values.length > 1 ? values.join(" | ") : null;
}

function applicability(source: DocumentationSource, topic: DocumentationTopic, target: DocumentationTarget): DocumentationApplicability {
  return deriveDocumentationApplicability(target, {
    product: topic.product || source.product,
    version: topic.version ?? source.version,
    update: topic.update ?? source.update,
    cpuFamily: candidateCpu(topic, target),
    firmware: typeof topic.attributes.firmware === "string" ? topic.attributes.firmware : null,
    language: typeof topic.attributes.language === "string" ? topic.attributes.language : null,
    locale: topic.locale,
    explicitScope: topic.explicitScope,
  });
}

const matchScore: Readonly<Record<Exclude<DocumentationMatchKind, "lexical">, number>> = { "exact-key": 100, "exact-title": 90, "exact-alias": 80 };
const applicabilityRank: Readonly<Record<DocumentationApplicability["state"], number>> = { exact: 5, compatible: 4, adjacent: 2, unknown: 1, conflicting: 0 };
const sourceRank: Readonly<Record<DocumentationSource["kind"], number>> = { "installed-help": 2, "official-online": 1 };

export class DocumentationRetrievalService {
  constructor(private readonly store: DocumentationStore) {}

  status(): DocumentationStatusResponse {
    const sources = this.store.listSources();
    return documentationStatusResponseSchema.parse({
      sources,
      topicCount: this.store.listTopics().length,
      currentSourceCount: sources.filter((source) => source.state === "ready" || source.state === "partial").length,
      blockedSourceCount: sources.filter((source) => source.state === "blocked").length,
      partial: sources.some((source) => source.state === "partial" || source.state === "blocked" || source.state === "failed"),
      statusNote: sources.length === 0 ? "No documentation sources are configured." : "Documentation sources are independent from engineering snapshots.",
    });
  }

  search(requestInput: DocumentationSearchRequest): DocumentationSearchResponse {
    const request = documentationSearchRequestSchema.parse(requestInput);
    const query = normalize(request.query);
    const hasKnownTarget = Object.values(request.target).some((value) => value !== null);
    let exactCandidateCount = 0;
    let hits = this.store.listTopics().flatMap((entry): DocumentationRetrievalHit[] => {
      const source = this.store.getSource(entry.topic.sourceId);
      if (!source || source.state === "blocked" || source.state === "failed") return [];
      const matchKind = this.exactMatch(entry, query);
      if (!matchKind) return [];
      exactCandidateCount += 1;
      const app = applicability(source, entry.topic, request.target);
      if (app.state === "conflicting" || (app.state === "adjacent" && !request.allowAdjacent) || (app.state === "unknown" && hasKnownTarget)) return [];
      return [this.hit(source, entry, matchKind, app)];
    }).sort((a, b) =>
      applicabilityRank[b.applicability.state] - applicabilityRank[a.applicability.state]
      || b.score - a.score
      || sourceRank[b.source.kind] - sourceRank[a.source.kind]
      || a.source.sourceId.localeCompare(b.source.sourceId)
      || a.topic.stableKey.localeCompare(b.topic.stableKey));

    if (hits.length === 0 && exactCandidateCount === 0) {
      hits = this.store.searchLexical(request.query, Math.min(100, request.limit * 5)).flatMap((entry): DocumentationRetrievalHit[] => {
        const source = this.store.getSource(entry.topic.sourceId);
        if (!source || source.state === "blocked" || source.state === "failed") return [];
        const app = applicability(source, entry.topic, request.target);
        if (app.state === "conflicting" || (app.state === "adjacent" && !request.allowAdjacent) || (app.state === "unknown" && hasKnownTarget)) return [];
        return [this.hit(source, entry, "lexical", app, entry.score, entry.snippet)];
      }).sort((a, b) =>
        applicabilityRank[b.applicability.state] - applicabilityRank[a.applicability.state]
        || sourceRank[b.source.kind] - sourceRank[a.source.kind]
        || b.score - a.score
        || a.source.sourceId.localeCompare(b.source.sourceId)
        || a.topic.stableKey.localeCompare(b.topic.stableKey));
    }

    const top = hits[0];
    if (top && (top.matchKind === "exact-title" || top.matchKind === "exact-alias")) {
      const ambiguous = hits.filter((hit) => hit.matchKind === top.matchKind
        && hit.score === top.score
        && applicabilityRank[hit.applicability.state] === applicabilityRank[top.applicability.state]);
      if (ambiguous.length > 1) throw new DocumentationAmbiguityError(ambiguous.map((hit) => ({
        sourceId: hit.source.sourceId, topicId: hit.topic.topicId, title: hit.topic.title,
        version: hit.source.version, update: hit.source.update,
      })));
    }

    const bounded = hits.slice(0, request.limit);
    return documentationSearchResponseSchema.parse({
      query: request.query,
      target: request.target,
      hits: bounded,
      partial: this.status().partial,
      statusNote: bounded.length > 0
        ? `Found ${bounded.length} ${bounded[0]?.matchKind === "lexical" ? "lexical" : "exact"} documentation result(s).`
        : "No documentation result matched the query and target applicability.",
    });
  }

  private exactMatch(entry: StoredDocumentationTopic, query: string): Exclude<DocumentationMatchKind, "lexical"> | null {
    if (normalize(entry.topic.stableKey) === query) return "exact-key";
    if (normalize(entry.topic.title) === query) return "exact-title";
    if (entry.topic.aliases.some((alias) => normalize(alias) === query)) return "exact-alias";
    return null;
  }

  private hit(source: DocumentationSource, entry: StoredDocumentationTopic, matchKind: DocumentationMatchKind, app: DocumentationApplicability, lexicalScore?: number, lexicalSnippet?: string): DocumentationRetrievalHit {
    if (source.indexedAt === null) throw new Error("Indexed documentation source is missing indexedAt.");
    const snippet = lexicalSnippet || entry.topic.excerpt || entry.content.slice(0, 2_000) || entry.topic.title;
    const score = matchKind === "lexical" ? lexicalScore ?? 0 : matchScore[matchKind];
    return {
      source, topic: entry.topic, matchKind, score, snippet, applicability: app,
      citation: {
        citationId: digest(source.sourceId, entry.topic.topicId, app.state, ...app.reasons),
        sourceId: source.sourceId, topicId: entry.topic.topicId, sourceKind: source.kind,
        sourceTitle: source.title, topicTitle: entry.topic.title, product: entry.topic.product,
        version: entry.topic.version, update: entry.topic.update, locale: entry.topic.locale,
        applicability: app, canonicalUrl: source.canonicalUrl, indexedAt: source.indexedAt,
      },
    };
  }
}
