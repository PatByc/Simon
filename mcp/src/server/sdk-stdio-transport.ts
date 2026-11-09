import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import type { OperatingMode } from "../policy/operating-modes.js";
import type { ToolRegistry } from "../registry/tool-registry.js";
import { createSdkMcpServer } from "./sdk-server.js";
import type { ServerTransport } from "./transport.js";

export class SdkStdioServerTransport implements ServerTransport {
  readonly kind = "stdio" as const;
  readonly #server;
  readonly #transport = new StdioServerTransport();

  constructor(registry: ToolRegistry, mode: OperatingMode) {
    this.#server = createSdkMcpServer(registry, mode);
  }

  async start(): Promise<void> {
    await this.#server.connect(this.#transport);
  }

  async stop(): Promise<void> {
    await this.#server.close();
  }
}
