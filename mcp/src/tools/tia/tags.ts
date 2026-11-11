import { z } from "zod";

import type { EngineeringConnector } from "../../connectors/connector.js";
import type { TiaV20ToolMapping } from "../../connectors/tia/v20/tool-map.js";
import { softwarePathInputSchema } from "../../contracts/tia/models.js";
import { createTiaTool } from "./create-tool.js";

export function createTagTools(
  connector: EngineeringConnector,
  mappings: readonly (TiaV20ToolMapping & { simonTool: string })[],
) {
  const get = (name: string) => mappings.find((item) => item.simonTool === name)!;
  return [
    createTiaTool(
      connector,
      get("simon_tia_list_tag_tables"),
      "List PLC tag tables",
      "List bounded PLC tag-table metadata directly through read-only TIA Openness APIs.",
      softwarePathInputSchema.extend({ limit: z.number().int().min(1).max(500).default(200) }).strict(),
    ),
    createTiaTool(
      connector,
      get("simon_tia_list_tags"),
      "List PLC tags",
      "List bounded PLC tag definitions directly from one or all PLC tag tables.",
      softwarePathInputSchema.extend({
        tablePath: z.string().max(2048).default(""),
        regexName: z.string().max(256).default(""),
        limit: z.number().int().min(1).max(1000).default(500),
      }).strict(),
    ),
  ];
}
