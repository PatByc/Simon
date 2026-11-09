import { EngineeringError } from "../contracts/common/errors.js";

export function unsupportedCapability(capability: string): EngineeringError {
  return new EngineeringError(
    "CAPABILITY_UNSUPPORTED",
    `The active engineering connector does not support '${capability}'.`,
    { capability },
  );
}
