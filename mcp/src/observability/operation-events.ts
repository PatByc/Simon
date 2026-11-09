import type { OperationCorrelation } from "./operation-context.js";

export type OperationEventPhase = "started" | "progress" | "completed" | "failed" | "cancelled";

export interface OperationEvent {
  readonly phase: OperationEventPhase;
  readonly message: string;
  readonly at: string;
  readonly correlation: OperationCorrelation;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type OperationEventSink = (event: OperationEvent) => void;
