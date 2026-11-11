import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type, type TObject } from "typebox";

import { ConventionService } from "./convention-service.js";

export const CONVENTION_STATUS_TOOL = "simon_convention_status";
export const CONVENTION_SEARCH_TOOL = "simon_convention_search_approved";

export class ConventionToolProvider {
  constructor(private readonly conventions: ConventionService) {}

  createPiTools(): readonly ToolDefinition<TObject>[] {
    return [
      {
        name: CONVENTION_STATUS_TOOL,
        label: "Get approved convention status",
        description: "Read counts for proposed, active, retired, and rejected conventions. Proposed content is not returned and this tool cannot decide or activate conventions.",
        promptSnippet: "Check whether approved local conventions exist before describing local practice.",
        promptGuidelines: ["Only approved revisions are authoritative local practice.", "Never treat proposal counts as approved guidance."],
        parameters: Type.Object({}, { additionalProperties: false }),
        execute: async () => {
          const status = this.conventions.status();
          const result = { proposedCount: status.proposed.length, activeCount: status.active.length, retiredCount: status.retired.length, rejectedCount: status.rejectedCount };
          return { content: [{ type: "text", text: JSON.stringify(result) }], details: { conventionStatus: result } };
        },
      },
      {
        name: CONVENTION_SEARCH_TOOL,
        label: "Search approved conventions",
        description: "Search immutable engineer-approved convention revisions. Inferred proposals and rejected or retired revisions are excluded.",
        promptSnippet: "Use approved revision IDs and evidence when explaining local practice.",
        promptGuidelines: ["Do not represent conventions as Siemens product semantics.", "Do not claim deterministic checks verify program behavior."],
        parameters: Type.Object({ query: Type.String({ minLength: 1, maxLength: 500 }), limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })) }, { additionalProperties: false }),
        execute: async (_toolCallId, params) => {
          const result = this.conventions.searchApproved({ query: params.query, limit: params.limit ?? 20 });
          return { content: [{ type: "text", text: JSON.stringify(result) }], details: { approvedConventionSearch: result } };
        },
      },
    ];
  }
}
