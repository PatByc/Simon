import { z } from "zod";
import type { EngineeringConnector } from "../../connectors/connector.js";
import type { TiaV20ToolMapping } from "../../connectors/tia/v20/tool-map.js";
import { softwarePathInputSchema } from "../../contracts/tia/models.js";
import { createTiaTool } from "./create-tool.js";

export function createPlcTypeTools(connector: EngineeringConnector, mappings: readonly (TiaV20ToolMapping & { simonTool: string })[]) {
  const get = (name: string) => mappings.find((item) => item.simonTool === name)!;
  return [
    createTiaTool(connector, get("simon_tia_get_plc_type"), "Get PLC data type", "Inspect one PLC data type.", softwarePathInputSchema.extend({ typePath: z.string().min(1).max(2048) }).strict()),
    createTiaTool(connector, get("simon_tia_find_plc_types"), "Find PLC data types", "Find PLC data types by bounded name or regular expression.", softwarePathInputSchema.extend({ regexName: z.string().max(256).default("") }).strict()),
  ];
}
