import { z } from "zod";
import type { EngineeringConnector } from "../../connectors/connector.js";
import { tiaV20HostMappings } from "../../connectors/tia/v20/tool-map.js";
import type { ToolDefinition } from "../../registry/tool-definition.js";
import { createTiaTool } from "./create-tool.js";

export function createConnectionTools(connector: EngineeringConnector): readonly ToolDefinition[] {
  const get = (name: string) => {
    const mapping = tiaV20HostMappings.find((item) => item.simonTool === name);
    if (!mapping) throw new Error(`Missing mapping '${name}'.`);
    return mapping;
  };
  const empty = z.object({}).strict();
  const connectInput = z.object({ processId: z.number().int().positive().optional() }).strict();
  return [
    createTiaTool(connector, get("simon_tia_list_processes"), "List TIA Portal processes", "Host-only discovery of attachable TIA Portal processes and whether they report an open project.", empty),
    createTiaTool(connector, get("simon_tia_connect"), "Connect to TIA Portal", "Host-controlled attachment to a selected existing TIA Portal process.", connectInput),
    createTiaTool(connector, get("simon_tia_disconnect"), "Disconnect from TIA Portal", "Host-controlled disposal of the TIA Openness connection.", empty),
  ];
}
