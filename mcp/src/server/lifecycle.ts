import { ServerLifecycleError } from "./errors.js";
import type { ServerTransport } from "./transport.js";

export type ServerLifecycleState = "idle" | "starting" | "running" | "stopping";

export class ServerLifecycle {
  readonly #transport: ServerTransport;
  #state: ServerLifecycleState = "idle";

  constructor(transport: ServerTransport) {
    this.#transport = transport;
  }

  get state(): ServerLifecycleState {
    return this.#state;
  }

  async start(): Promise<void> {
    if (this.#state !== "idle") {
      throw new ServerLifecycleError(
        "SERVER_ALREADY_RUNNING",
        `Cannot start MCP server while it is ${this.#state}.`,
      );
    }

    this.#state = "starting";
    try {
      await this.#transport.start();
      this.#state = "running";
    } catch (cause) {
      this.#state = "idle";
      throw new ServerLifecycleError("SERVER_START_FAILED", "Failed to start MCP server.", {
        cause,
      });
    }
  }

  async stop(): Promise<void> {
    if (this.#state !== "running") {
      throw new ServerLifecycleError(
        "SERVER_NOT_RUNNING",
        `Cannot stop MCP server while it is ${this.#state}.`,
      );
    }

    this.#state = "stopping";
    try {
      await this.#transport.stop();
      this.#state = "idle";
    } catch (cause) {
      this.#state = "running";
      throw new ServerLifecycleError("SERVER_STOP_FAILED", "Failed to stop MCP server.", {
        cause,
      });
    }
  }
}
