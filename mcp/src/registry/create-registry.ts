import type { EngineeringConnector } from "../connectors/connector.js";
import { createTiaTools } from "../tools/tia/index.js";
import { ToolRegistry } from "./tool-registry.js";

export function createToolRegistry(connector: EngineeringConnector): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of createTiaTools(connector)) registry.register(tool);
  return registry;
}
