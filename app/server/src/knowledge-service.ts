import type { KnowledgeSearchResponse, KnowledgeSource } from "@simon/contracts";

const fixtures: KnowledgeSource[] = [
  {
    sourceId: "synthetic-pump-permissive",
    title: "Pump permissive example",
    objectPath: "SyntheticPlant/PLC_1/Program blocks/FB_PumpControl/Network 3",
    excerpt: "The pump command is enabled only when the safety chain, process permissive, and reset state are all valid.",
    provenance: "synthetic_fixture",
    synthetic: true,
  },
  {
    sourceId: "synthetic-fault-reset",
    title: "Fault reset pattern",
    objectPath: "SyntheticPlant/PLC_1/Program blocks/FB_PumpControl/Network 5",
    excerpt: "A rising reset edge clears the latched non-safety demonstration fault after the permissive condition returns.",
    provenance: "synthetic_fixture",
    synthetic: true,
  },
  {
    sourceId: "synthetic-timer",
    title: "Restart delay timer",
    objectPath: "SyntheticPlant/PLC_1/Program blocks/FB_PumpControl/Network 6",
    excerpt: "The restart delay uses a synthetic TON timer with a five-second preset before the command becomes available.",
    provenance: "synthetic_fixture",
    synthetic: true,
  },
];

function terms(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 1);
}

export class KnowledgeService {
  search(query: string): KnowledgeSearchResponse {
    const queryTerms = new Set(terms(query));
    const ranked = fixtures
      .map((source) => {
        const haystack = terms(`${source.title} ${source.objectPath} ${source.excerpt}`);
        const score = haystack.reduce((total, term) => total + (queryTerms.has(term) ? 1 : 0), 0);
        return { source, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.source.title.localeCompare(b.source.title))
      .map((item) => item.source);

    return {
      query,
      sources: ranked,
      coverage: {
        complete: false,
        note: "Results come only from bundled synthetic fixtures; no TIA project or external documentation was searched.",
      },
    };
  }
}
