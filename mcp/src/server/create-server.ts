import { ServerLifecycle } from "./lifecycle.js";
import type { ServerTransport } from "./transport.js";

export interface McpProtocolHost {
  readonly lifecycle: ServerLifecycle;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createMcpProtocolHost(transport: ServerTransport): McpProtocolHost {
  const lifecycle = new ServerLifecycle(transport);

  return {
    lifecycle,
    start: () => lifecycle.start(),
    stop: () => lifecycle.stop(),
  };
}
