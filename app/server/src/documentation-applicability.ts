import {
  documentationApplicabilitySchema,
  type DocumentationApplicability,
  type DocumentationApplicabilityEvidence,
  type DocumentationTarget,
} from "@simon/contracts";

type ApplicabilityField = DocumentationApplicabilityEvidence["field"];

type CandidateApplicability = Pick<
  DocumentationTarget,
  "product" | "version" | "update" | "cpuFamily" | "firmware" | "language" | "locale"
> & { explicitScope: string | null };

const fields: readonly ApplicabilityField[] = [
  "product", "version", "update", "cpuFamily", "firmware", "language", "locale",
];

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

export function deriveDocumentationApplicability(
  target: DocumentationTarget,
  candidate: CandidateApplicability,
): DocumentationApplicability {
  const evidence: DocumentationApplicabilityEvidence[] = [];
  for (const field of fields) {
    const targetValue = target[field];
    if (targetValue === null) continue;
    const sourceValue = candidate[field];
    evidence.push({
      field,
      targetValue,
      sourceValue,
      relation: sourceValue === null
        ? "missing"
        : normalized(sourceValue) === normalized(targetValue) ? "exact" : "different",
    });
  }

  if (evidence.length === 0) {
    return documentationApplicabilitySchema.parse({
      state: "unknown",
      evidence,
      reasons: ["No target applicability fields are known."],
      explicitScope: candidate.explicitScope,
    });
  }

  const different = evidence.filter((item) => item.relation === "different");
  const missing = evidence.filter((item) => item.relation === "missing");
  const exact = evidence.filter((item) => item.relation === "exact");
  let state: DocumentationApplicability["state"];

  if (different.length > 0) {
    state = different.every((item) => item.field === "version" || item.field === "update")
      && !evidence.some((item) => item.field === "product" && item.relation !== "exact")
      ? "adjacent"
      : "conflicting";
  } else if (exact.length === 0) {
    state = "unknown";
  } else if (missing.length > 0) {
    state = "compatible";
  } else {
    state = "exact";
  }

  const reasons = evidence.map((item) => {
    if (item.relation === "exact") return `${item.field} matches '${item.targetValue}'.`;
    if (item.relation === "missing") return `${item.field} applicability is not stated by the source.`;
    return `${item.field} target '${item.targetValue}' differs from source '${item.sourceValue}'.`;
  });

  return documentationApplicabilitySchema.parse({ state, evidence, reasons, explicitScope: candidate.explicitScope });
}
