import { describe, expect, it, vi } from "vitest";

import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { SourceExtractionRequest } from "@simon/mcp";
import type { TiaProcess } from "@simon/contracts";
import type { TObject } from "typebox";

import type { EngineeringMcpGateway } from "./engineering-mcp-client.js";
import { EngineeringMcpSnapshotCollector } from "./engineering-snapshot-collector.js";

class Gateway implements EngineeringMcpGateway {
  readonly listProcesses = vi.fn(async (): Promise<TiaProcess[]> => []);
  readonly attach = vi.fn(async () => undefined);
  readonly getState = vi.fn(async () => ({ connected: true, projectName: "Plant" }));
  readonly getOpenProjects = vi.fn(async () => []);
  readonly getProjectTree = vi.fn(async () => "Plant\n└── PlcSoftware: PLC_1 [PLC Program]");
  readonly detach = vi.fn(async () => undefined);
  readonly close = vi.fn(async () => undefined);
  readonly extractSource = vi.fn(async (request: SourceExtractionRequest) => ({
    kind: request.kind,
    engineeringPath: request.engineeringPath,
    totalBytes: 12,
    artifacts: [{ artifactId: "11111111-1111-4111-8111-111111111111", digest: "a".repeat(64), bytes: 12, createdAt: "2026-01-01T00:00:00.000Z", mediaType: "application/xml", format: "xml" as const }],
  }));
  readonly readArtifact = vi.fn(async () => new TextEncoder().encode("<Document />"));

  async callSnapshotTool(name: string): Promise<Record<string, unknown>> {
    if (name === "simon_tia_list_tag_tables") return { items: [{ path: "PLC tags/Inputs", name: "Inputs", tagCount: 1 }], totalCount: 1, truncated: false };
    if (name === "simon_tia_list_tags") return { items: [{ tablePath: "PLC tags/Inputs", name: "Ready", dataType: "Bool", logicalAddress: "%I0.0", comment: "Ready" }], totalCount: 1, truncated: false };
    if (name === "simon_tia_find_blocks") return { items: [{ path: "Program blocks/Main", name: "Main", typeName: "OB", programmingLanguage: "SCL", isConsistent: true }] };
    if (name === "simon_tia_find_plc_types") return { items: [{ path: "PLC data types/Valve", name: "Valve", typeName: "PlcStruct", isConsistent: true }] };
    if (name === "simon_tia_find_tag_usages") return { items: [{ block: "Main", symbol: "Ready", rootName: "Inputs", memberName: "Ready", networkTitle: "Cycle", accessScope: "GlobalVariable" }] };
    throw new Error(`Unexpected tool ${name}`);
  }

  async createPiTools(): Promise<readonly ToolDefinition<TObject>[]> { return []; }
}

describe("EngineeringMcpSnapshotCollector", () => {
  it("collects direct tags, controlled source artifacts, types, and bounded references", async () => {
    const gateway = new Gateway();
    const collector = new EngineeringMcpSnapshotCollector(gateway);
    const result = await collector.collect({
      snapshotId: "22222222-2222-4222-8222-222222222222",
      conversationId: "33333333-3333-4333-8333-333333333333",
      binding: {
        bindingId: "44444444-4444-4444-8444-444444444444",
        epoch: "55555555-5555-4555-8555-555555555555",
        processId: 42,
        processStartTime: "2026-01-01T00:00:00.000Z",
        projectName: "Plant",
        projectPathHash: "b".repeat(64),
        observedAt: "2026-01-01T00:00:01.000Z",
      },
      forceRefresh: false,
      limits: { maxObjects: 100, maxBytes: 1_000_000, maxDurationMs: 30_000, maxResultsPerQuery: 20 },
      resumeFrom: null,
      signal: new AbortController().signal,
    });

    expect(result.tagTables[0]).toMatchObject({
      engineeringPath: "PLC tags/Inputs",
      tags: [{ name: "Ready", logicalAddress: "%I0.0" }],
      coverage: "complete",
    });
    expect(result.documents).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "block", engineeringPath: "Program blocks/Main", content: "<Document />", artifactId: expect.any(String) }),
      expect.objectContaining({ kind: "type", engineeringPath: "PLC data types/Valve", content: "<Document />" }),
    ]));
    expect(result.references[0]).toMatchObject({ symbol: "Ready", sourceOperation: "tia.analysis.tagUsages" });
    expect(gateway.extractSource).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(result.coverage)).not.toMatch(/Plant|PLC_1|Users[\\/]/);
  });
});
