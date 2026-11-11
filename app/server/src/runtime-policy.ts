export const SYNTHETIC_KNOWLEDGE_TOOL_NAME = "simon_search_synthetic_knowledge";

export const TIA_READONLY_TOOL_NAMES = Object.freeze([
  "simon_tia_get_state",
  "simon_tia_get_open_projects",
  "simon_tia_get_project_tree",
  "simon_tia_list_devices",
  "simon_tia_get_device",
  "simon_tia_get_device_item",
  "simon_tia_get_software",
  "simon_tia_get_software_tree",
  "simon_tia_list_tag_tables",
  "simon_tia_list_tags",
  "simon_tia_get_block",
  "simon_tia_find_blocks",
  "simon_tia_get_block_tree",
  "simon_tia_analyze_db_members",
  "simon_tia_analyze_parameter_dbs",
  "simon_tia_find_tag_usages",
  "simon_tia_analyze_analog_inputs",
  "simon_tia_analyze_analog_outputs",
  "simon_tia_get_plc_type",
  "simon_tia_find_plc_types",
  "simon_engineering_snapshot_status",
  "simon_engineering_search",
  "simon_engineering_find_references",
] as const);

export const RUNTIME_POLICY = Object.freeze({
  allowedTools: Object.freeze([SYNTHETIC_KNOWLEDGE_TOOL_NAME] as const),
  externalAccess: false,
  mutations: false,
  scope: "Bundled synthetic engineering fixtures only",
});

export interface RuntimePolicy {
  readonly mode: "synthetic" | "tia-readonly";
  readonly allowedTools: readonly string[];
  readonly externalAccess: boolean;
  readonly mutations: false;
  readonly scope: string;
}

export function getRuntimePolicy(env: NodeJS.ProcessEnv = process.env): RuntimePolicy {
  if (env.SIMON_ENGINEERING_MODE === "tia-readonly") {
    return {
      mode: "tia-readonly",
      allowedTools: TIA_READONLY_TOOL_NAMES,
      externalAccess: true,
      mutations: false,
      scope: "Read-only access to the engineer-selected TIA Portal V20 project through Simon MCP",
    };
  }
  return { mode: "synthetic", ...RUNTIME_POLICY };
}

const forbiddenToolNames = new Set(["bash", "read", "write", "edit", "browser", "mcp", "tia"]);

export function assertRuntimePolicy(policy: RuntimePolicy = getRuntimePolicy({})): void {
  for (const tool of policy.allowedTools) {
    if (forbiddenToolNames.has(tool.toLowerCase())) {
      throw new Error(`Forbidden runtime tool configured: ${tool}`);
    }
  }
  if (policy.mutations) {
    throw new Error("The current Simon runtime policy must remain read-only");
  }
  if (policy.mode === "tia-readonly") {
    const allowed = new Set(TIA_READONLY_TOOL_NAMES);
    if (policy.allowedTools.some((tool) => !allowed.has(tool as (typeof TIA_READONLY_TOOL_NAMES)[number]))) {
      throw new Error("Unclassified TIA runtime tool configured");
    }
  } else if (policy.externalAccess) {
    throw new Error("Synthetic mode cannot have external access");
  }
}
