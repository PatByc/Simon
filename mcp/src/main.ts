import { loadConfig } from "./config.js";
import type { EngineeringConnector } from "./connectors/connector.js";
import { TiaV20Connector } from "./connectors/tia/v20/connector.js";
import { createToolRegistry } from "./registry/create-registry.js";
import { createMcpProtocolHost } from "./server/create-server.js";
import { SdkStdioServerTransport } from "./server/sdk-stdio-transport.js";
import { FakeEngineeringConnector } from "./testing/fake-connector.js";

async function createConnector(): Promise<EngineeringConnector> {
  const config = loadConfig();
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

const connector = await createConnector();
const registry = createToolRegistry(connector);
const host = createMcpProtocolHost(new SdkStdioServerTransport(registry, "tia-readonly"));

const shutdown = async () => {
  if (host.lifecycle.state === "running") await host.stop();
  await connector.close();
};
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

await host.start();
