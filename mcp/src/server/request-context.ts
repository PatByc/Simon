import { randomUUID } from "node:crypto";

export interface McpRequestContext {
  readonly requestId: string;
  readonly operationId: string;
  readonly toolCallId?: string;
  readonly signal: AbortSignal;
  readonly startedAt: Date;
}

export interface CreateRequestContextOptions {
  readonly requestId?: string;
  readonly operationId?: string;
  readonly toolCallId?: string;
  readonly signal?: AbortSignal;
  readonly startedAt?: Date;
}

export function createRequestContext(
  options: CreateRequestContextOptions = {},
): McpRequestContext {
  const context: McpRequestContext = {
    requestId: options.requestId ?? randomUUID(),
    operationId: options.operationId ?? randomUUID(),
    signal: options.signal ?? new AbortController().signal,
    startedAt: options.startedAt ?? new Date(),
  };

  if (options.toolCallId === undefined) {
    return context;
  }

  return { ...context, toolCallId: options.toolCallId };
}
