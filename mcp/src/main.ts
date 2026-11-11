import path from "node:path";
import { ArtifactStore } from "./artifacts/artifact-store.js";
import { loadConfig, type SimonMcpConfig } from "./config.js";
import type { EngineeringConnector } from "./connectors/connector.js";
import { TiaV20Connector } from "./connectors/tia/v20/connector.js";
import { createToolRegistry } from "./registry/create-registry.js";
import { createMcpProtocolHost } from "./server/create-server.js";
import { SourceExtractor } from "./sources/source-extractor.js";
import { SdkStdioServerTransport } from "./server/sdk-stdio-transport.js";
import { FakeEngineeringConnector } from "./testing/fake-connector.js";

async function createConnector(config: SimonMcpConfig): Promise<EngineeringConnector> {
  if (config.connector === "simulated") {
    return new FakeEngineeringConnector();
  }
  const allowedEnv = Object.fromEntries(
    ["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "TiaPortalLocation"]
      .flatMap((name) => process.env[name] === undefined ? [] : [[name, process.env[name]!]]),
  );
  const connector = new TiaV20Connector({
    executable: config.tiaV20Executable,
    env: allowedEnv,
    timeoutMs: config.toolTimeoutMs,
  });
  await connector.initialize();
  return connector;
}

const config = loadConfig();
const connector = await createConnector(config);
const artifactStore = new ArtifactStore(config.artifactRoot, 50_000_000);
const registry = createToolRegistry(connector, config.connector === "tia-v20" ? {
  artifactStore,
  sourceExtractor: new SourceExtractor(connector, artifactStore, {
    workRoot: path.join(path.dirname(config.artifactRoot), `${path.basename(config.artifactRoot)}-work`),
    maxFiles: 4,
    maxTotalBytes: 50_000_000,
  }),
} : {});
const host = createMcpProtocolHost(new SdkStdioServerTransport(registry, "tia-readonly"));

const shutdown = async () => {
  if (host.lifecycle.state === "running") await host.stop();
  await connector.close();
};
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

await host.start();
