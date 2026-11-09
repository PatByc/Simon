import type { OperatingMode } from "./operating-modes.js";
import type { ToolEffect } from "./effects.js";
import type { ToolExposure } from "./exposure.js";

export interface ToolPolicyMetadata {
  readonly effect: ToolEffect;
  readonly exposure: ToolExposure;
  readonly allowedModes: readonly OperatingMode[];
  readonly requiresConnection: boolean;
  readonly requiresProjectBinding: boolean;
  readonly createsArtifacts: boolean;
  readonly invalidatesContext: boolean;
  readonly timeoutMs: number;
}

export function mayExposeToModel(policy: ToolPolicyMetadata, mode: OperatingMode): boolean {
  return policy.exposure === "model" && policy.allowedModes.includes(mode);
}
