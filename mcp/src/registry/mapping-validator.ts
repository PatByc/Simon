import type { ToolDefinition } from "./tool-definition.js";

export function validateMappingCompleteness(
  upstreamTools: readonly string[],
  tools: readonly ToolDefinition[],
  classifiedBlockedTools: readonly string[],
): void {
  const classified = new Set([
    ...tools.map((tool) => tool.mapping.upstreamTool),
    ...classifiedBlockedTools,
  ]);
  const unknown = upstreamTools.filter((name) => !classified.has(name));
  if (unknown.length > 0) {
    throw new Error(`Unclassified upstream tools are denied: ${unknown.join(", ")}`);
  }
}
