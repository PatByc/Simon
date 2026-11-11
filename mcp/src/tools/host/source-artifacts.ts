import { z } from "zod";

import type { ArtifactStore } from "../../artifacts/artifact-store.js";
import { sourceExtractionRequestSchema, type SourceExtractor } from "../../sources/source-extractor.js";
import type { ToolDefinition } from "../../registry/tool-definition.js";

export const SOURCE_EXTRACTION_TOOL_NAME = "simon_tia_extract_source";
export const ARTIFACT_READ_TOOL_NAME = "simon_tia_read_artifact";

const artifactReadSchema = z.object({ artifactId: z.string().uuid() }).strict();

export function createSourceArtifactTools(
  extractor: SourceExtractor,
  artifacts: ArtifactStore,
): readonly ToolDefinition[] {
  const extractionTool: ToolDefinition<typeof sourceExtractionRequestSchema> = {
      name: SOURCE_EXTRACTION_TOOL_NAME,
      title: "Extract TIA source internally",
      description: "Host-only controlled source extraction into Simon-owned opaque artifacts.",
      inputSchema: sourceExtractionRequestSchema,
      mapping: { upstreamTool: "SimonSourceExtractor", connectorOperation: "simon.source.extract", simonTool: SOURCE_EXTRACTION_TOOL_NAME },
      policy: {
        effect: "artifact-producing-read",
        exposure: "host-only",
        allowedModes: ["tia-readonly"],
        requiresConnection: true,
        requiresProjectBinding: true,
        createsArtifacts: true,
        invalidatesContext: false,
        timeoutMs: 120_000,
      },
      qualification: "live-tested",
      handler: (input, context) => extractor.extract(input, context),
    };
  const artifactTool: ToolDefinition<typeof artifactReadSchema> = {
      name: ARTIFACT_READ_TOOL_NAME,
      title: "Read opaque TIA artifact",
      description: "Host-only bounded read of an opaque Simon artifact identifier.",
      inputSchema: artifactReadSchema,
      mapping: { upstreamTool: "SimonArtifactStore", connectorOperation: "simon.artifact.read", simonTool: ARTIFACT_READ_TOOL_NAME },
      policy: {
        effect: "artifact-producing-read",
        exposure: "host-only",
        allowedModes: ["tia-readonly"],
        requiresConnection: true,
        requiresProjectBinding: true,
        createsArtifacts: false,
        invalidatesContext: false,
        timeoutMs: 30_000,
      },
      qualification: "live-tested",
      handler: async (input) => {
        const content = await artifacts.read(input.artifactId);
        return { artifactId: input.artifactId, bytes: content.byteLength, contentBase64: Buffer.from(content).toString("base64") };
      },
    };
  return [extractionTool, artifactTool];
}
