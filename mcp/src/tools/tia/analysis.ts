import { z } from "zod";
import type { EngineeringConnector } from "../../connectors/connector.js";
import type { TiaV20ToolMapping } from "../../connectors/tia/v20/tool-map.js";
import { softwarePathInputSchema } from "../../contracts/tia/models.js";
import { createTiaTool } from "./create-tool.js";

export function createAnalysisTools(connector: EngineeringConnector, mappings: readonly (TiaV20ToolMapping & { simonTool: string })[]) {
  const get = (name: string) => mappings.find((item) => item.simonTool === name)!;
  const filtered = softwarePathInputSchema.extend({ pattern: z.string().max(256).optional(), forceRefresh: z.boolean().default(false) }).strict();
  return [
    createTiaTool(connector, get("simon_tia_analyze_db_members"), "Analyze DB members", "Analyze complete DB member definitions from a controlled XML snapshot.", filtered),
    createTiaTool(connector, get("simon_tia_analyze_parameter_dbs"), "Analyze parameter DBs", "Analyze parameter DB members and exact usages.", filtered),
    createTiaTool(connector, get("simon_tia_find_tag_usages"), "Find tag usages", "Find exact tag references across exported block networks.", softwarePathInputSchema.extend({ tagPattern: z.string().min(1).max(256), forceRefresh: z.boolean().default(false) }).strict()),
    createTiaTool(connector, get("simon_tia_analyze_analog_inputs"), "Analyze analog inputs", "Analyze Convert_IW channel wiring.", filtered),
    createTiaTool(connector, get("simon_tia_analyze_analog_outputs"), "Analyze analog outputs", "Analyze Convert_QW channel wiring.", filtered),
  ];
}
