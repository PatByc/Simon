export type ServerTransportKind = "stdio";

export interface ServerTransport {
  readonly kind: ServerTransportKind;
  start(): Promise<void>;
  stop(): Promise<void>;
}
