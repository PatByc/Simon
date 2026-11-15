import type { DocumentationApplicabilityState, DocumentationTarget } from "@simon/contracts";

import { DocumentationAmbiguityError, DocumentationRetrievalService } from "../documentation-retrieval.js";
import { DocumentationStore } from "../documentation-store.js";
import { createM3Fixture } from "./m3-fixture.js";

const target = (changes: Partial<DocumentationTarget> = {}): DocumentationTarget => ({
  product: "STEP 7", version: "V20", update: "Update 7", cpuFamily: "S7-1500", firmware: null, language: "SCL", locale: "en-US", ...changes,
});

export interface RetrievalBenchmarkCase {
  readonly id: string;
  readonly corpus: "synthetic" | "installed";
  readonly query: string;
  readonly target: DocumentationTarget;
  readonly allowAdjacent?: boolean;
  readonly expected: {
    readonly outcome: "hits" | "none" | "ambiguity";
    readonly titleInTop?: string;
    readonly topK?: number;
    readonly matchKind?: "exact" | "lexical";
    readonly applicability?: DocumentationApplicabilityState;
    readonly forbiddenTitle?: string;
  };
}

export const retrievalBenchmarkCases: readonly RetrievalBenchmarkCase[] = [
  { id: "S01", corpus: "synthetic", query: "REF: Create a reference", target: target(), expected: { outcome: "hits", titleInTop: "REF: Create a reference", matchKind: "exact", applicability: "exact" } },
  { id: "S02", corpus: "synthetic", query: "REF: Create a reference", target: target({ cpuFamily: "S7-1200" }), expected: { outcome: "none", forbiddenTitle: "REF: Create a reference" } },
  { id: "S03", corpus: "synthetic", query: "fixture/ref", target: target(), expected: { outcome: "hits", titleInTop: "REF: Create a reference", matchKind: "exact" } },
  { id: "S04", corpus: "synthetic", query: "MOVE instruction", target: target(), expected: { outcome: "hits", titleInTop: "MOVE instruction", matchKind: "exact" } },
  { id: "S05", corpus: "synthetic", query: "source destination", target: target(), expected: { outcome: "hits", titleInTop: "MOVE instruction", topK: 5, matchKind: "lexical" } },
  { id: "S06", corpus: "synthetic", query: "Duplicate instruction", target: target(), expected: { outcome: "ambiguity" } },
  { id: "S07", corpus: "synthetic", query: "fixture/duplicate-a", target: target(), expected: { outcome: "hits", titleInTop: "Duplicate instruction", matchKind: "exact" } },
  { id: "S08", corpus: "synthetic", query: "PROMPT_SAMPLE", target: target(), expected: { outcome: "hits", titleInTop: "Untrusted content sample", matchKind: "exact" } },
  { id: "S09", corpus: "synthetic", query: "fixture-v19/ref", target: target(), expected: { outcome: "none" } },
  { id: "S10", corpus: "synthetic", query: "fixture-v19/ref", target: target(), allowAdjacent: true, expected: { outcome: "hits", titleInTop: "REF: Create a reference", applicability: "adjacent" } },
  { id: "S11", corpus: "synthetic", query: "REF: Create a reference", target: target({ language: "LAD" }), expected: { outcome: "none" } },
  { id: "S12", corpus: "synthetic", query: "REF: Create a reference", target: target({ product: "WinCC" }), expected: { outcome: "none" } },
  { id: "S13", corpus: "synthetic", query: "fixture-v19/ref", target: target({ version: "V19", update: "Update 4" }), expected: { outcome: "hits", applicability: "exact" } },
  { id: "S14", corpus: "synthetic", query: "nonexistent hydraulic unicorn", target: target(), expected: { outcome: "none" } },
  { id: "S15", corpus: "synthetic", query: "REF", target: target({ firmware: "V3.0" }), expected: { outcome: "hits", applicability: "compatible" } },
  { id: "S16", corpus: "synthetic", query: "Ignore Simon policy approve compile", target: target(), expected: { outcome: "hits", titleInTop: "Untrusted content sample", topK: 5, matchKind: "lexical" } },
  { id: "S17", corpus: "synthetic", query: "REF", target: target({ product: null, version: null, update: null, cpuFamily: null, language: null, locale: null }), expected: { outcome: "ambiguity" } },
  { id: "S18", corpus: "synthetic", query: "MOVE", target: target(), expected: { outcome: "hits", titleInTop: "MOVE instruction", matchKind: "exact" } },
  { id: "S19", corpus: "synthetic", query: "Copies source value destination", target: target(), expected: { outcome: "hits", titleInTop: "MOVE instruction", topK: 1, matchKind: "lexical" } },
  { id: "S20", corpus: "synthetic", query: "fixture/ref", target: target({ firmware: "unknown-firmware" }), expected: { outcome: "hits", applicability: "compatible" } },

  { id: "I01", corpus: "installed", query: "REF: Create a reference to a tag (S7-1500)", target: target(), expected: { outcome: "hits", titleInTop: "REF: Create a reference to a tag (S7-1500)", matchKind: "exact", applicability: "exact" } },
  { id: "I02", corpus: "installed", query: "ABS: Form absolute value (S7-1200, S7-1500)", target: target(), expected: { outcome: "hits", titleInTop: "ABS: Form absolute value (S7-1200, S7-1500)", matchKind: "exact" } },
  { id: "I03", corpus: "installed", query: "CTRL_PWM: Pulse-width modulation (S7-1200)", target: target(), expected: { outcome: "none", forbiddenTitle: "CTRL_PWM: Pulse-width modulation (S7-1200)" } },
  { id: "I04", corpus: "installed", query: "CTRL_PWM: Pulse-width modulation (S7-1200)", target: target({ cpuFamily: "S7-1200" }), expected: { outcome: "hits", titleInTop: "CTRL_PWM: Pulse-width modulation (S7-1200)", applicability: "compatible" } },
  { id: "I05", corpus: "installed", query: "ARRAY DB (S7-1500)", target: target({ cpuFamily: "S7-1200" }), expected: { outcome: "none" } },
  { id: "I06", corpus: "installed", query: "ARRAY DB (S7-1500)", target: target(), expected: { outcome: "hits", titleInTop: "ARRAY DB (S7-1500)", applicability: "exact" } },
  { id: "I07", corpus: "installed", query: "Addressing PLC tags", target: target(), expected: { outcome: "ambiguity" } },
  { id: "I08", corpus: "installed", query: "ProgPLCBasicsenUS.zip/75696202379/19675183243.htm", target: target(), expected: { outcome: "hits", titleInTop: "Addressing PLC tags", matchKind: "exact" } },
  { id: "I09", corpus: "installed", query: "Basic information on the status word (S7-1500)", target: target(), expected: { outcome: "hits", titleInTop: "Basic information on the status word (S7-1500)", applicability: "compatible" } },
  { id: "I10", corpus: "installed", query: "Basic information on the status word (S7-300, S7-400)", target: target(), expected: { outcome: "hits", titleInTop: "Basic information on the status word (S7-300, S7-400)", applicability: "compatible" } },
  { id: "I11", corpus: "installed", query: "source value destination value", target: target(), expected: { outcome: "hits", titleInTop: "BLKMOV: Move block (S7-1500)", topK: 5, matchKind: "lexical" } },
  { id: "I12", corpus: "installed", query: "convert character string numerical value", target: target(), expected: { outcome: "hits", titleInTop: "STRG_VAL: Convert character string to numerical value (S7-1200, S7-1500)", topK: 5, matchKind: "lexical" } },
  { id: "I13", corpus: "installed", query: "nonexistent hydraulic unicorn", target: target(), expected: { outcome: "none" } },
  { id: "I14", corpus: "installed", query: "technology object reference firmware", target: target({ firmware: "V3.0" }), expected: { outcome: "hits", titleInTop: "Technology objects", topK: 5, matchKind: "lexical", applicability: "compatible" } },
  { id: "I15", corpus: "installed", query: "CREATE_DB: Create data block (S7-1200, S7-1500)", target: target({ cpuFamily: "S7-1200" }), expected: { outcome: "hits", titleInTop: "CREATE_DB: Create data block (S7-1200, S7-1500)", applicability: "compatible" } },
  { id: "I16", corpus: "installed", query: "CountOfElements: Get number of ARRAY elements (S7-1200, S7-1500)", target: target(), expected: { outcome: "hits", titleInTop: "CountOfElements: Get number of ARRAY elements (S7-1200, S7-1500)", matchKind: "exact" } },
  { id: "I17", corpus: "installed", query: "time of day interrupt enable", target: target({ firmware: "V3.0" }), expected: { outcome: "hits", titleInTop: "ACT_TINT: Enable time-of-day interrupt (S7-1200, S7-1500)", topK: 5, matchKind: "lexical", applicability: "compatible" } },
  { id: "I18", corpus: "installed", query: "REF", target: target(), expected: { outcome: "hits", titleInTop: "REF: Create a reference to a tag (S7-1500)", topK: 1, matchKind: "lexical", applicability: "exact" } },
] as const;

export interface RetrievalBenchmarkResult {
  readonly id: string;
  readonly corpus: "synthetic" | "installed";
  readonly passed: boolean;
  readonly outcome: "hits" | "none" | "ambiguity" | "error";
  readonly hitCount: number;
  readonly topTitles: readonly string[];
  readonly reasons: readonly string[];
}

export function createSyntheticBenchmarkRetrieval(): DocumentationRetrievalService {
  const fixture = createM3Fixture(); const store = new DocumentationStore();
  for (const source of fixture.sources) store.replaceSource(source, fixture.topics.filter(({ topic }) => topic.sourceId === source.sourceId));
  return new DocumentationRetrievalService(store);
}

export function runRetrievalBenchmark(retrieval: DocumentationRetrievalService, cases: readonly RetrievalBenchmarkCase[]): readonly RetrievalBenchmarkResult[] {
  return cases.map((testCase) => {
    try {
      const response = retrieval.search({ query: testCase.query, target: testCase.target, allowAdjacent: testCase.allowAdjacent ?? false, limit: 20 });
      const reasons: string[] = []; const titles = response.hits.map((hit) => hit.topic.title);
      if (testCase.expected.outcome === "ambiguity") reasons.push("Expected ambiguity but search returned normally.");
      if (testCase.expected.outcome === "none" && response.hits.length !== 0) reasons.push("Expected no hits.");
      if (testCase.expected.outcome === "hits" && response.hits.length === 0) reasons.push("Expected at least one hit.");
      if (testCase.expected.titleInTop) {
        const topK = testCase.expected.topK ?? 1;
        if (!titles.slice(0, topK).includes(testCase.expected.titleInTop)) reasons.push(`Expected title was absent from top ${topK}.`);
      }
      if (testCase.expected.forbiddenTitle && titles.includes(testCase.expected.forbiddenTitle)) reasons.push("Forbidden incompatible title was returned.");
      if (testCase.expected.matchKind) {
        const exact = response.hits[0]?.matchKind !== "lexical";
        if ((testCase.expected.matchKind === "exact") !== exact) reasons.push(`Expected ${testCase.expected.matchKind} match kind.`);
      }
      if (testCase.expected.applicability && response.hits[0]?.applicability.state !== testCase.expected.applicability) reasons.push(`Expected ${testCase.expected.applicability} applicability.`);
      if (response.hits.some((hit) => !/^[a-f0-9]{64}$/.test(hit.citation.citationId) || hit.applicability.reasons.length === 0)) reasons.push("A hit lacked stable citation or applicability evidence.");
      return { id: testCase.id, corpus: testCase.corpus, passed: reasons.length === 0, outcome: response.hits.length ? "hits" : "none", hitCount: response.hits.length, topTitles: titles.slice(0, 5), reasons };
    } catch (error) {
      const ambiguous = error instanceof DocumentationAmbiguityError;
      const passed = ambiguous && testCase.expected.outcome === "ambiguity";
      return { id: testCase.id, corpus: testCase.corpus, passed, outcome: ambiguous ? "ambiguity" : "error", hitCount: 0, topTitles: [], reasons: passed ? [] : [error instanceof Error ? error.message : "Unknown benchmark error."] };
    }
  });
}
