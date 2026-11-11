import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import { buildApp } from "./app.js";
import { ConventionService } from "./convention-service.js";
import { ConventionStore } from "./convention-store.js";
import { ConventionToolProvider } from "./convention-tools.js";
import { initializeDocumentationSources } from "./documentation-initialization.js";
import { DocumentationRetrievalService } from "./documentation-retrieval.js";
import { DocumentationRetrievalToolProvider } from "./documentation-retrieval-tools.js";
import { DocumentationStore } from "./documentation-store.js";
import { EngineeringConnectionManager } from "./engineering-connection.js";
import { EngineeringMcpClient } from "./engineering-mcp-client.js";
import { EngineeringRetrievalService } from "./engineering-retrieval.js";
import { EngineeringRetrievalToolProvider } from "./engineering-retrieval-tools.js";
import { EngineeringSnapshotService } from "./engineering-snapshot.js";
import { EngineeringMcpSnapshotCollector } from "./engineering-snapshot-collector.js";
import { FakeAssistant } from "./fake-assistant.js";
import { PiAssistant } from "./pi-assistant.js";
import { getRuntimePolicy } from "./runtime-policy.js";
import { InMemoryStore } from "./store.js";
import { UsageService } from "./usage-service.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const host = process.env.SIMON_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.SIMON_PORT ?? "4310", 10);
const runtimeName = process.env.SIMON_RUNTIME ?? "pi";
const dataDirectory = resolve(process.env.SIMON_DATA_DIR ?? resolve(projectRoot, "data"));
const store = new InMemoryStore(resolve(dataDirectory, "simon.sqlite"));
const documentationStore = new DocumentationStore(resolve(dataDirectory, "documentation.sqlite"));
const configuredHelpRoot = process.env.SIMON_TIA_V20_HELP_ROOT?.trim();
const installedHelpRoot = configuredHelpRoot || resolve(process.env.ProgramFiles ?? "C:/Program Files", "Siemens/Automation/Portal V20/Help/en-US");
initializeDocumentationSources(documentationStore, {
  installedRoot: installedHelpRoot,
  packageAllowlist: ["ProgSCL2MenUS.zip", "ProgPLCBasicsenUS.zip", "ProgExtInstr2MenUS.zip"],
});
const documentationRetrieval = new DocumentationRetrievalService(documentationStore);
const documentationRetrievalTools = new DocumentationRetrievalToolProvider(documentationRetrieval);
const conventions = new ConventionService(new ConventionStore(resolve(dataDirectory, "conventions.sqlite")));
const conventionTools = new ConventionToolProvider(conventions);
const engineeringPolicy = getRuntimePolicy();
const engineeringClient = engineeringPolicy.mode === "tia-readonly"
  ? new EngineeringMcpClient({
      command: process.execPath,
      args: [resolve(projectRoot, "mcp/dist/src/main.js")],
      cwd: projectRoot,
      artifactRoot: resolve(dataDirectory, "mcp-artifacts"),
    })
  : null;
const engineering = new EngineeringConnectionManager(store, engineeringPolicy, engineeringClient);
const snapshots = new EngineeringSnapshotService(
  engineering,
  engineeringClient
    ? new EngineeringMcpSnapshotCollector(engineeringClient)
    : { collect: async () => { throw new Error("TIA read-only mode is required for engineering snapshots."); } },
  undefined,
  undefined,
  undefined,
  store,
);
const engineeringRetrievalTools = new EngineeringRetrievalToolProvider(
  engineering,
  snapshots,
  new EngineeringRetrievalService(),
  store,
);
const assistant = runtimeName === "fake"
  ? new FakeAssistant(store)
  : new PiAssistant(store, projectRoot, resolve(dataDirectory, "pi-sessions"), engineering, engineeringRetrievalTools, documentationRetrievalTools, conventionTools);
const app = buildApp({
  logger: true,
  store,
  assistant,
  usageService: new UsageService(resolve(process.env.USERPROFILE ?? "", ".pi/agent/auth.json")),
  engineering,
  snapshots,
  engineeringRetrieval: new EngineeringRetrievalService(),
  documentationRetrieval,
  conventions,
});
const webRoot = resolve(projectRoot, "app/web/dist");

if (existsSync(webRoot)) {
  await app.register(fastifyStatic, { root: webRoot, prefix: "/" });
  app.setNotFoundHandler((request, reply) => {
    if (request.method === "GET" && !request.url.startsWith("/api/")) {
      return reply.sendFile("index.html");
    }
    return reply.code(404).send({
      code: "not_found",
      message: "Route not found",
      correlationId: request.id,
    });
  });
}

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
