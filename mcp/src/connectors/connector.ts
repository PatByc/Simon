import type { McpRequestContext } from "../server/request-context.js";

export interface ConnectorIdentity {
  readonly kind: string;
  readonly version: string;
  readonly implementation: string;
  readonly provenance?: Readonly<Record<string, string>>;
}

export interface ConnectorCapability {
  readonly name: string;
  readonly available: boolean;
  readonly reason?: string;
}

export interface EngineeringConnector {
  readonly identity: ConnectorIdentity;
  listCapabilities(): readonly ConnectorCapability[];
  supports(capability: string): boolean;
  invoke<TInput, TOutput>(capability: string, input: TInput, context: McpRequestContext): Promise<TOutput>;
  close(): Promise<void>;
}
