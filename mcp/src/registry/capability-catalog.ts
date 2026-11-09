import type { EngineeringConnector } from "../connectors/connector.js";
import type { ToolDefinition } from "./tool-definition.js";

export interface CapabilityAvailability {
  readonly tool: string;
  readonly operation: string;
  readonly available: boolean;
  readonly reason?: string;
}

export function buildCapabilityCatalog(
  tools: readonly ToolDefinition[],
  connector: EngineeringConnector,
): readonly CapabilityAvailability[] {
  return tools.map((tool) => {
    const available = connector.supports(tool.mapping.connectorOperation);
    return available
      ? { tool: tool.name, operation: tool.mapping.connectorOperation, available }
      : {
          tool: tool.name,
          operation: tool.mapping.connectorOperation,
          available,
          reason: "Connector capability is unavailable.",
        };
  });
}
