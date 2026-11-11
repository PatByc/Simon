import { conventionCheckResultSchema, type ConventionCheckResult, type ConventionRevision } from "@simon/contracts";

export function checkConventionNamingPrefix(
  revision: ConventionRevision,
  input: { readonly name: string; readonly objectKind: string; readonly exceptionAcknowledged?: boolean },
): ConventionCheckResult {
  const base = { checkKind: "deterministic-text-check" as const, revisionId: revision.revisionId, subject: input.name, functionalVerification: false as const };
  if (revision.state !== "approved") return conventionCheckResultSchema.parse({ ...base, status: "not-applicable", explanation: "The convention revision is not active; no conformance claim was made." });
  if (!revision.scope.some((scope) => scope.localeCompare(input.objectKind, undefined, { sensitivity: "accent" }) === 0)) return conventionCheckResultSchema.parse({ ...base, status: "not-applicable", explanation: `The approved convention scope does not include '${input.objectKind}'.` });
  if (input.exceptionAcknowledged) return conventionCheckResultSchema.parse({ ...base, status: "not-applicable", explanation: "A host-acknowledged exception applies; the naming check was not evaluated." });
  const match = revision.rule.match(/^Use the prefix '([^']+)' for .+ names in the observed project scope\.$/);
  if (!match?.[1]) return conventionCheckResultSchema.parse({ ...base, status: "unknown", explanation: "This approved rule is not supported by the deterministic naming-prefix checker." });
  const expected = match[1];
  const conforms = input.name.startsWith(expected);
  return conventionCheckResultSchema.parse({
    ...base,
    status: conforms ? "conforms" : "deviation",
    explanation: conforms
      ? `The name starts with the approved textual prefix '${expected}'. This does not verify program behavior.`
      : `The name does not start with the approved textual prefix '${expected}'. This is a naming deviation only, not a functional defect.`,
  });
}
