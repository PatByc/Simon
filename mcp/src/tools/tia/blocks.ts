import { z } from "zod";
import type { EngineeringConnector } from "../../connectors/connector.js";
import type { TiaV20ToolMapping } from "../../connectors/tia/v20/tool-map.js";
import { softwarePathInputSchema } from "../../contracts/tia/models.js";
import { createTiaTool } from "./create-tool.js";

export function createBlockTools(connector: EngineeringConnector, mappings: readonly (TiaV20ToolMapping & { simonTool: string })[]) {
  const get = (name: string) => mappings.find((item) => item.simonTool === name)!;
  return [
    createTiaTool(connector, get("simon_tia_get_block"), "Get PLC block", "Inspect one PLC block by full engineering path.", softwarePathInputSchema.extend({ blockPath: z.string().min(1).max(2048) }).strict()),
    createTiaTool(connector, get("simon_tia_find_blocks"), "Find PLC blocks", "Find PLC blocks by bounded name or regular expression.", softwarePathInputSchema.extend({ regexName: z.string().max(256).default("") }).strict()),
    createTiaTool(connector, get("simon_tia_get_block_tree"), "Get PLC block tree", "Return PLC blocks with group hierarchy.", softwarePathInputSchema.strict()),
  ];
}
