import { describe, expect, it } from "vitest";
import { createRequestContext } from "../../src/server/request-context.js";
import { FakeEngineeringConnector } from "../../src/testing/fake-connector.js";
import { createToolRegistry } from "../../src/registry/create-registry.js";
import { tiaV20BlockedTools, tiaV20ToolMap } from "../../src/connectors/tia/v20/tool-map.js";
import { validateMappingCompleteness } from "../../src/registry/mapping-validator.js";

describe("tool registry", () => {
  it("exposes only classified read tools to the model", () => {
    const connector = new FakeEngineeringConnector(Object.fromEntries(tiaV20ToolMap.map((item) => [item.connectorOperation, {}])));
    const registry = createToolRegistry(connector);
    const tools = registry.listForModel("tia-readonly");
    expect(tools).toHaveLength(18);
    expect(tools.every((tool) => tool.policy.exposure === "model")).toBe(true);
    expect(tools.every((tool) => !tool.policy.invalidatesContext)).toBe(true);
  });

  it("denies unclassified tools", () => {
    const registry = createToolRegistry(new FakeEngineeringConnector());
    expect(() => registry.require("unknown_tool")).toThrow(/unclassified and denied/);
  });

  it("classifies the complete reviewed upstream catalog", () => {
    const upstream = tiaV20ToolMap.map((item) => item.upstreamTool);
    const registry = createToolRegistry(new FakeEngineeringConnector());
    expect(() => validateMappingCompleteness(upstream, registry.list(), tiaV20BlockedTools)).not.toThrow();
    expect(() => validateMappingCompleteness([...upstream, "NewUnsafeTool"], registry.list(), tiaV20BlockedTools)).toThrow(/NewUnsafeTool/);
  });

  it("invokes a connector capability through a Simon tool", async () => {
    const connector = new FakeEngineeringConnector({ "tia.connection.status": { connected: true } });
    const tool = createToolRegistry(connector).require("simon_tia_get_state");
    await expect(tool.handler({}, createRequestContext())).resolves.toEqual({ connected: true });
  });
});
