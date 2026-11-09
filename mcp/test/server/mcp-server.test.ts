import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createToolRegistry } from "../../src/registry/create-registry.js";
import { createSdkMcpServer } from "../../src/server/sdk-server.js";
import { FakeEngineeringConnector } from "../../src/testing/fake-connector.js";

describe("Simon MCP server", () => {
  it("lists and calls the read-only catalog over MCP", async () => {
    const connector = new FakeEngineeringConnector({ "tia.connection.status": { connected: true } });
    const server = createSdkMcpServer(createToolRegistry(connector), "tia-readonly");
    const client = new Client({ name: "test", version: "1" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const tools = await client.listTools();
    expect(tools.tools).toHaveLength(21);
    expect(tools.tools.some((tool) => tool.name === "simon_tia_get_state")).toBe(true);
    expect(tools.tools.some((tool) => tool.name === "simon_tia_connect")).toBe(true);
    const result = await client.callTool({ name: "simon_tia_get_state", arguments: {} });
    expect(result.structuredContent).toEqual({ connected: true });
    await client.close();
    await server.close();
  });
});
