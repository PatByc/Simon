import { z } from "zod";

import type { EngineeringConnector } from "../../connectors/connector.js";
import type { TiaV20ToolMapping } from "../../connectors/tia/v20/tool-map.js";
import { createTiaTool } from "./create-tool.js";

export function createProjectTools(connector: EngineeringConnector, mappings: readonly (TiaV20ToolMapping & { simonTool: string })[]) {
  const byName = new Map(mappings.map((item) => [item.simonTool, item]));
  const mapping = (name: string) => {
    const value = byName.get(name);
    if (!value) throw new Error(`Missing mapping '${name}'.`);
    return value;
  };
  const empty = z.object({}).strict();
  return [
    createTiaTool(connector, mapping("simon_tia_get_state"), "Get TIA state", "Return current TIA connection and project state.", empty),
    createTiaTool(connector, mapping("simon_tia_get_open_projects"), "List open TIA projects", "List local projects already open in TIA Portal.", empty),
    createTiaTool(connector, mapping("simon_tia_get_project_tree"), "Get TIA project tree", "Return the bounded structure of the bound TIA project.", empty),
  ];
}
