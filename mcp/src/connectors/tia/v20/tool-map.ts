import type { ToolEffect, ToolExposure } from "../../../policy/index.js";

export interface TiaV20ToolMapping {
  readonly upstreamTool: string;
  readonly connectorOperation: string;
  readonly simonTool?: string;
  readonly effect: ToolEffect;
  readonly exposure: ToolExposure;
  readonly requiresConnection: boolean;
  readonly requiresProjectBinding: boolean;
  readonly createsArtifacts: boolean;
  readonly invalidatesContext: boolean;
  readonly timeoutMs: number;
}

const read = (
  upstreamTool: string,
  connectorOperation: string,
  simonTool: string,
  options: Partial<TiaV20ToolMapping> = {},
): TiaV20ToolMapping => ({
  upstreamTool,
  connectorOperation,
  simonTool,
  effect: "project-read",
  exposure: "model",
  requiresConnection: true,
  requiresProjectBinding: true,
  createsArtifacts: false,
  invalidatesContext: false,
  timeoutMs: 30_000,
  ...options,
});

const restricted = (
  upstreamTool: string,
  connectorOperation: string,
  effect: ToolEffect,
  exposure: ToolExposure,
  options: Partial<TiaV20ToolMapping> = {},
): TiaV20ToolMapping => ({
  upstreamTool,
  connectorOperation,
  effect,
  exposure,
  requiresConnection: true,
  requiresProjectBinding: true,
  createsArtifacts: false,
  invalidatesContext: effect !== "status-read" && effect !== "project-read" && effect !== "artifact-producing-read" && effect !== "preview",
  timeoutMs: 60_000,
  ...options,
});

export const tiaV20ToolMap: readonly TiaV20ToolMapping[] = [
  { ...restricted("GetPortalProcesses", "tia.connection.listProcesses", "status-read", "host-only", { requiresConnection: false, requiresProjectBinding: false }), simonTool: "simon_tia_list_processes" },
  { ...restricted("Connect", "tia.connection.attach", "process-control", "host-only", { requiresConnection: false, requiresProjectBinding: false, timeoutMs: 120_000 }), simonTool: "simon_tia_connect" },
  { ...restricted("Disconnect", "tia.connection.disconnect", "process-control", "host-only", { requiresProjectBinding: false }), simonTool: "simon_tia_disconnect" },
  read("GetState", "tia.connection.status", "simon_tia_get_state", { effect: "status-read", requiresConnection: false, requiresProjectBinding: false }),
  read("GetProject", "tia.project.listOpen", "simon_tia_get_open_projects", { requiresProjectBinding: false }),
  restricted("OpenProject", "tia.project.open", "process-control", "blocked", { requiresProjectBinding: false }),
  restricted("SaveProject", "tia.project.save", "save", "blocked"),
  restricted("SaveAsProject", "tia.project.saveAs", "save", "blocked"),
  restricted("CloseProject", "tia.project.close", "process-control", "blocked"),
  read("GetProjectTree", "tia.project.getTree", "simon_tia_get_project_tree", { timeoutMs: 180_000 }),
  read("GetDeviceInfo", "tia.device.get", "simon_tia_get_device"),
  read("GetDeviceItemInfo", "tia.device.getItem", "simon_tia_get_device_item"),
  read("GetDevices", "tia.device.list", "simon_tia_list_devices"),
  read("GetSoftwareInfo", "tia.software.get", "simon_tia_get_software"),
  restricted("CompileSoftware", "tia.software.compile", "compile", "blocked"),
  read("GetSoftwareTree", "tia.software.getTree", "simon_tia_get_software_tree"),
  read("GetBlockInfo", "tia.block.get", "simon_tia_get_block"),
  read("GetBlocks", "tia.block.search", "simon_tia_find_blocks"),
  read("GetBlocksWithHierarchy", "tia.block.getTree", "simon_tia_get_block_tree"),
  restricted("ExportBlock", "tia.block.export", "artifact-producing-read", "internal", { createsArtifacts: true }),
  restricted("ImportBlock", "tia.block.import", "project-mutation", "blocked"),
  restricted("ExportBlocks", "tia.block.exportMany", "artifact-producing-read", "internal", { createsArtifacts: true, timeoutMs: 120_000 }),
  read("AnalyzeDbMembers", "tia.analysis.dbMembers", "simon_tia_analyze_db_members", { effect: "artifact-producing-read", createsArtifacts: true, timeoutMs: 120_000 }),
  read("AnalyzeParameterDbs", "tia.analysis.parameterDbs", "simon_tia_analyze_parameter_dbs", { effect: "artifact-producing-read", createsArtifacts: true, timeoutMs: 120_000 }),
  read("FindTagUsages", "tia.analysis.tagUsages", "simon_tia_find_tag_usages", { effect: "artifact-producing-read", createsArtifacts: true, timeoutMs: 120_000 }),
  read("AnalyzeAnalogInputs", "tia.analysis.analogInputs", "simon_tia_analyze_analog_inputs", { effect: "artifact-producing-read", createsArtifacts: true, timeoutMs: 120_000 }),
  read("AnalyzeAnalogOutputs", "tia.analysis.analogOutputs", "simon_tia_analyze_analog_outputs", { effect: "artifact-producing-read", createsArtifacts: true, timeoutMs: 120_000 }),
  restricted("PreviewAnalogInputPatches", "tia.preview.analogInputs", "preview", "blocked", { createsArtifacts: true }),
  restricted("PreviewAnalogOutputPatches", "tia.preview.analogOutputs", "preview", "blocked", { createsArtifacts: true }),
  restricted("ApplyAnalogInputPatches", "tia.mutation.analogInputs", "project-mutation", "blocked", { createsArtifacts: true, timeoutMs: 180_000 }),
  restricted("ApplyAnalogOutputPatches", "tia.mutation.analogOutputs", "project-mutation", "blocked", { createsArtifacts: true, timeoutMs: 180_000 }),
  read("GetTypeInfo", "tia.type.get", "simon_tia_get_plc_type"),
  read("GetTypes", "tia.type.search", "simon_tia_find_plc_types"),
  restricted("ExportType", "tia.type.export", "artifact-producing-read", "internal", { createsArtifacts: true }),
  restricted("ImportType", "tia.type.import", "project-mutation", "blocked"),
  restricted("ExportTypes", "tia.type.exportMany", "artifact-producing-read", "internal", { createsArtifacts: true, timeoutMs: 120_000 }),
  restricted("ExportAsDocuments", "tia.document.export", "artifact-producing-read", "internal", { createsArtifacts: true }),
  restricted("ExportBlocksAsDocuments", "tia.document.exportMany", "artifact-producing-read", "internal", { createsArtifacts: true, timeoutMs: 120_000 }),
  restricted("GenerateBlocksFromSource", "tia.block.generateFromSource", "project-mutation", "blocked", { createsArtifacts: true }),
  restricted("ImportFromDocuments", "tia.document.import", "project-mutation", "blocked"),
  restricted("ImportBlocksFromDocuments", "tia.document.importMany", "project-mutation", "blocked", { timeoutMs: 180_000 }),
];

export const tiaV20ModelMappings = tiaV20ToolMap.filter(
  (mapping): mapping is TiaV20ToolMapping & { readonly simonTool: string } =>
    mapping.exposure === "model" && mapping.simonTool !== undefined,
);

export const tiaV20HostMappings = tiaV20ToolMap.filter(
  (mapping): mapping is TiaV20ToolMapping & { readonly simonTool: string } =>
    mapping.exposure === "host-only" && mapping.simonTool !== undefined,
);

export const tiaV20BlockedTools = tiaV20ToolMap
  .filter((mapping) => mapping.exposure === "blocked" || mapping.exposure === "internal")
  .map((mapping) => mapping.upstreamTool);
