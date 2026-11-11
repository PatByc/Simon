import type { z } from "zod";

import type { EngineeringConnector } from "../../connectors/connector.js";
import type { TiaV20ToolMapping } from "../../connectors/tia/v20/tool-map.js";
import type { ToolDefinition } from "../../registry/tool-definition.js";

export function createTiaTool<TSchema extends z.ZodType>(
  connector: EngineeringConnector,
  mapping: TiaV20ToolMapping & { readonly simonTool: string },
  title: string,
  description: string,
  inputSchema: TSchema,
): ToolDefinition<TSchema> {
  return {
    name: mapping.simonTool,
    title,
    description,
    inputSchema,
    mapping: {
      upstreamTool: mapping.upstreamTool,
      connectorOperation: mapping.connectorOperation,
      simonTool: mapping.simonTool,
    },
    policy: {
      effect: mapping.effect,
      exposure: mapping.exposure,
      allowedModes: ["tia-readonly"],
      requiresConnection: mapping.requiresConnection,
      requiresProjectBinding: mapping.requiresProjectBinding,
      createsArtifacts: mapping.createsArtifacts,
      invalidatesContext: mapping.invalidatesContext,
      timeoutMs: mapping.timeoutMs,
    },
    qualification: "live-tested",
    handler: async (input, context) => connector.invoke(mapping.connectorOperation, input, context),
  };
}
