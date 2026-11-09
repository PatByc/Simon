export type EngineeringErrorCode =
  | "CONNECTOR_UNAVAILABLE"
  | "CAPABILITY_UNSUPPORTED"
  | "TIA_NOT_RUNNING"
  | "TIA_NOT_CONNECTED"
  | "NO_PROJECT_OPEN"
  | "PROJECT_MISMATCH"
  | "INVALID_ARGUMENTS"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_FAILURE"
  | "RESULT_TOO_LARGE"
  | "OPERATION_CANCELLED";

export class EngineeringError extends Error {
  constructor(
    readonly code: EngineeringErrorCode,
    message: string,
    readonly details: Readonly<Record<string, unknown>> = {},
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "EngineeringError";
  }
}
