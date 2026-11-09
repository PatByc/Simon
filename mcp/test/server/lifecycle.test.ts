import { describe, expect, it, vi } from "vitest";

import {
  ServerLifecycleError,
  createMcpProtocolHost,
  createRequestContext,
  type ServerTransport,
} from "../../src/server/index.js";

function createTransport(): ServerTransport & {
  start: ReturnType<typeof vi.fn<() => Promise<void>>>;
  stop: ReturnType<typeof vi.fn<() => Promise<void>>>;
} {
  return {
    kind: "stdio",
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
  };
}

describe("MCP server lifecycle", () => {
  it("starts and stops through the configured transport", async () => {
    const transport = createTransport();
    const host = createMcpProtocolHost(transport);

    await host.start();
    expect(host.lifecycle.state).toBe("running");
    expect(transport.start).toHaveBeenCalledOnce();

    await host.stop();
    expect(host.lifecycle.state).toBe("idle");
    expect(transport.stop).toHaveBeenCalledOnce();
  });

  it("rejects invalid lifecycle transitions", async () => {
    const host = createMcpProtocolHost(createTransport());

    await expect(host.stop()).rejects.toMatchObject<Partial<ServerLifecycleError>>({
      code: "SERVER_NOT_RUNNING",
    });

    await host.start();
    await expect(host.start()).rejects.toMatchObject<Partial<ServerLifecycleError>>({
      code: "SERVER_ALREADY_RUNNING",
    });
  });
});

describe("MCP request context", () => {
  it("creates stable correlation identifiers", () => {
    const context = createRequestContext({ toolCallId: "tool-1" });

    expect(context.requestId).toBeTruthy();
    expect(context.operationId).toBeTruthy();
    expect(context.toolCallId).toBe("tool-1");
    expect(context.signal.aborted).toBe(false);
  });
});
