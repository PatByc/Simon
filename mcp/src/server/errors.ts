export type ServerErrorCode =
  | "SERVER_ALREADY_RUNNING"
  | "SERVER_NOT_RUNNING"
  | "SERVER_START_FAILED"
  | "SERVER_STOP_FAILED";

export class ServerLifecycleError extends Error {
  readonly code: ServerErrorCode;
  readonly cause?: unknown;

  constructor(code: ServerErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "ServerLifecycleError";
    this.code = code;
    this.cause = options?.cause;
  }
}
