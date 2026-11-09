import { z } from "zod";
import type { EngineeringConnector } from "../../connectors/connector.js";
import type { TiaV20ToolMapping } from "../../connectors/tia/v20/tool-map.js";
import { softwarePathInputSchema } from "../../contracts/tia/models.js";
import { createTiaTool } from "./create-tool.js";

export function createSoftwareTools(connector: EngineeringConnector, mappings: readonly (TiaV20ToolMapping & { simonTool: string })[]) {
  const get = (name: string) => mappings.find((item) => item.simonTool === name)!;
  return [
    createTiaTool(connector, get("simon_tia_get_software"), "Get PLC software", "Inspect a PLC software container.", softwarePathInputSchema.strict()),
    createTiaTool(connector, get("simon_tia_get_software_tree"), "Get PLC software tree", "Return blocks and types in a PLC software container.", softwarePathInputSchema.strict()),
  ];
}
