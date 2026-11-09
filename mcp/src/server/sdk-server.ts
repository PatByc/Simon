import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";

import type { OperatingMode } from "../policy/operating-modes.js";
import type { ToolRegistry } from "../registry/tool-registry.js";
import { createRequestContext } from "./request-context.js";

export function createSdkMcpServer(registry: ToolRegistry, mode: OperatingMode): McpServer {
  const server = new McpServer({ name: "simon-engineering-mcp", version: "0.1.0" }, { maxToolInputElements: 2_000 });
  for (const tool of registry.listForMcp(mode)) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema as z.ZodType,
        annotations: { readOnlyHint: tool.policy.effect !== "project-mutation" },
        _meta: { effect: tool.policy.effect, connectorOperation: tool.mapping.connectorOperation },
      },
      async (input) => {
        const result = await tool.handler(input, createRequestContext());
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: typeof result === "object" && result !== null
            ? result as Record<string, unknown>
            : { value: result },
        };
      },
    );
  }
  return server;
}
