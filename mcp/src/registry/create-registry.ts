import type { ArtifactStore } from "../artifacts/artifact-store.js";
import type { EngineeringConnector } from "../connectors/connector.js";
import type { SourceExtractor } from "../sources/source-extractor.js";
import { createSourceArtifactTools } from "../tools/host/source-artifacts.js";
import { createTiaTools } from "../tools/tia/index.js";
import { ToolRegistry } from "./tool-registry.js";

export interface ToolRegistryOptions {
  readonly sourceExtractor?: SourceExtractor;
  readonly artifactStore?: ArtifactStore;
}

export function createToolRegistry(connector: EngineeringConnector, options: ToolRegistryOptions = {}): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of createTiaTools(connector)) registry.register(tool);
  if (options.sourceExtractor && options.artifactStore) {
    for (const tool of createSourceArtifactTools(options.sourceExtractor, options.artifactStore)) registry.register(tool);
  }
  return registry;
}
