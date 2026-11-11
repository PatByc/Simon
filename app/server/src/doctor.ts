import { resolve } from "node:path";
import { EngineeringConnectionManager } from "./engineering-connection.js";
import { EngineeringMcpClient } from "./engineering-mcp-client.js";
import { getRuntimePolicy } from "./runtime-policy.js";
import { InMemoryStore } from "./store.js";

const projectRoot = resolve(import.meta.dirname, "../../..");
const policy = getRuntimePolicy();
const client = policy.mode === "tia-readonly"
  ? new EngineeringMcpClient({
      command: process.execPath,
      args: [resolve(projectRoot, "mcp/dist/src/main.js")],
      cwd: projectRoot,
      artifactRoot: resolve(process.env.SIMON_DATA_DIR ?? resolve(projectRoot, "data"), "mcp-artifacts"),
    })
  : null;
const manager = new EngineeringConnectionManager(new InMemoryStore(), policy, client);

try {
  if (policy.mode === "tia-readonly") await manager.listProcesses();
  process.stdout.write(`${JSON.stringify(manager.getDiagnostics(), null, 2)}\n`);
} finally {
  await manager.close();
}
