export interface OperationCorrelation {
  readonly runId?: string;
  readonly mcpRequestId: string;
  readonly toolCallId?: string;
  readonly operationId: string;
  readonly connectorCallId?: string;
  readonly upstreamRequestId?: string;
  readonly artifactIds: readonly string[];
}
