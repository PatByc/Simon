import { z } from "zod";
import type { EngineeringConnector } from "../../connectors/connector.js";
import type { TiaV20ToolMapping } from "../../connectors/tia/v20/tool-map.js";
import { createTiaTool } from "./create-tool.js";

export function createDeviceTools(connector: EngineeringConnector, mappings: readonly (TiaV20ToolMapping & { simonTool: string })[]) {
  const get = (name: string) => mappings.find((item) => item.simonTool === name)!;
  return [
    createTiaTool(connector, get("simon_tia_list_devices"), "List devices", "List devices in the bound project.", z.object({}).strict()),
    createTiaTool(connector, get("simon_tia_get_device"), "Get device", "Inspect a device by engineering path.", z.object({ devicePath: z.string().min(1).max(2048) }).strict()),
    createTiaTool(connector, get("simon_tia_get_device_item"), "Get device item", "Inspect a device item by engineering path.", z.object({ deviceItemPath: z.string().min(1).max(2048) }).strict()),
  ];
}
