import type { z } from "zod";

import type { ToolPolicyMetadata } from "../policy/tool-policy.js";
import type { McpRequestContext } from "../server/request-context.js";

export const qualificationStatuses = ["planned", "implemented", "fake-tested", "live-tested", "enabled"] as const;
export type QualificationStatus = (typeof qualificationStatuses)[number];

export interface ToolMapping {
  readonly upstreamTool: string;
  readonly connectorOperation: string;
  readonly simonTool: string;
}

export interface ToolDefinition<TSchema extends z.ZodType = z.ZodType> {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: TSchema;
  readonly policy: ToolPolicyMetadata;
  readonly mapping: ToolMapping;
  readonly qualification: QualificationStatus;
  readonly handler: (input: z.output<TSchema>, context: McpRequestContext) => Promise<unknown>;
}
