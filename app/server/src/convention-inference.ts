import { createHash } from "node:crypto";

import { conventionDraftSchema, type ConventionDraft, type ConventionEvidence } from "@simon/contracts";

export interface AuthorizedConventionExample {
  readonly authorization: "host-authorized";
  readonly evidenceId: string;
  readonly sourceId: string;
  readonly citation: string;
  readonly excerpt: string;
  readonly observedAt: string;
  readonly objectKind: string;
  readonly name: string;
}

function digest(...parts: readonly string[]): string { return createHash("sha256").update(parts.join("\0")).digest("hex"); }
function prefix(name: string): string | null { return name.match(/^([A-Za-z][A-Za-z0-9]{1,15})[_-]/)?.[1] ?? null; }

export function inferNamingConventions(examples: readonly AuthorizedConventionExample[], now = new Date().toISOString()): readonly ConventionDraft[] {
  if (examples.some((example) => example.authorization !== "host-authorized")) throw new Error("Convention inference requires host-authorized examples.");
  const groups = new Map<string, AuthorizedConventionExample[]>();
  for (const example of examples) {
    if (!example.name.trim() || !example.objectKind.trim()) continue;
    const group = groups.get(example.objectKind) ?? [];
    group.push(example);
    groups.set(example.objectKind, group);
  }

  const drafts: ConventionDraft[] = [];
  for (const [objectKind, unsortedGroup] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const group = [...unsortedGroup].sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
    if (group.length < 3) continue;
    const counts = new Map<string, number>();
    for (const example of group) {
      const value = prefix(example.name);
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const winner = ranked[0];
    if (!winner) continue;
    const [observedPrefix, count] = winner;
    const ratio = count / group.length;
    if (count < 3 || ratio < 0.7) continue;
    const matches = group.filter((example) => prefix(example.name) === observedPrefix);
    const exceptions = group.filter((example) => prefix(example.name) !== observedPrefix).map((example) => `${example.name} does not use ${observedPrefix}_.`);
    const evidence: ConventionEvidence[] = matches.slice(0, 10).map((example) => ({
      evidenceId: example.evidenceId,
      authority: "observed-project",
      sourceId: example.sourceId,
      citation: example.citation,
      excerpt: example.excerpt,
      observedAt: example.observedAt,
    }));
    const evidenceIds = evidence.map((item) => item.evidenceId).sort();
    drafts.push(conventionDraftSchema.parse({
      conventionId: digest("naming-prefix", objectKind, observedPrefix, ...evidenceIds),
      state: "proposed",
      title: `${objectKind} naming prefix ${observedPrefix}_`,
      rule: `Use the prefix '${observedPrefix}_' for ${objectKind} names in the observed project scope.`,
      rationale: `${count} of ${group.length} host-authorized examples (${Math.round(ratio * 100)}%) use this prefix. This is an inferred local pattern, not an approved rule.`,
      scope: [objectKind],
      evidence,
      exceptions,
      confidence: ratio >= 0.9 && count >= 5 ? "high" : ratio >= 0.8 ? "medium" : "low",
      createdAt: now,
      createdBy: "simon-inference",
    }));
  }
  return drafts;
}
