import { EngineeringError } from "../contracts/common/errors.js";
import type { ProjectBinding } from "../contracts/tia/models.js";

export function assertProjectBinding(expected: ProjectBinding, actual: ProjectBinding | null): void {
  if (actual?.projectId !== expected.projectId || actual.observedPathHash !== expected.observedPathHash) {
    throw new EngineeringError("PROJECT_MISMATCH", "The active TIA project no longer matches this operation's binding.");
  }
}
