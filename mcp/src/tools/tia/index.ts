import type { EngineeringConnector } from "../../connectors/connector.js";
import { tiaV20ModelMappings } from "../../connectors/tia/v20/tool-map.js";
import type { ToolDefinition } from "../../registry/tool-definition.js";
import { createAnalysisTools } from "./analysis.js";
import { createBlockTools } from "./blocks.js";
import { createConnectionTools } from "./connection.js";
import { createDeviceTools } from "./devices.js";
import { createPlcTypeTools } from "./plc-types.js";
import { createProjectTools } from "./project.js";
import { createSoftwareTools } from "./software.js";
import { createTagTools } from "./tags.js";

export function createTiaTools(connector: EngineeringConnector): readonly ToolDefinition[] {
  return [
    ...createConnectionTools(connector),
    ...createProjectTools(connector, tiaV20ModelMappings),
    ...createDeviceTools(connector, tiaV20ModelMappings),
    ...createSoftwareTools(connector, tiaV20ModelMappings),
    ...createTagTools(connector, tiaV20ModelMappings),
    ...createBlockTools(connector, tiaV20ModelMappings),
    ...createAnalysisTools(connector, tiaV20ModelMappings),
    ...createPlcTypeTools(connector, tiaV20ModelMappings),
  ];
}
