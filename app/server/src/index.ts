import { existsSync } from "node:fs";
import { Worker } from "node:worker_threads";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import { buildApp } from "./app.js";
import type { AssistantRuntime } from "./assistant-runtime.js";
import { ConventionService } from "./convention-service.js";
import { ConventionStore } from "./convention-store.js";
import { prepareDocumentationSources } from "./documentation-initialization.js";
import { DocumentationRetrievalService } from "./documentation-retrieval.js";
import { DocumentationStore } from "./documentation-store.js";
import { EngineeringConnectionManager } from "./engineering-connection.js";
import { EngineeringRetrievalService } from "./engineering-retrieval.js";
import { EngineeringSnapshotService } from "./engineering-snapshot.js";
import { FakeAssistant } from "./fake-assistant.js";
import { getRuntimePolicy } from "./runtime-policy.js";
import { InMemoryStore } from "./store.js";
import { UsageService } from "./usage-service.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const host = process.env.SIMON_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.SIMON_PORT ?? "4310", 10);
const runtimeName = process.env.SIMON_RUNTIME ?? "pi";
const dataDirectory = resolve(process.env.SIMON_DATA_DIR ?? resolve(projectRoot, "data"));
const store = new InMemoryStore(resolve(dataDirectory, "simon.sqlite"));
const documentationDatabasePath = resolve(dataDirectory, "documentation.sqlite");
const documentationStore = new DocumentationStore(documentationDatabasePath);
const configuredHelpRoot = process.env.SIMON_TIA_V20_HELP_ROOT?.trim();
const installedHelpRoot = configuredHelpRoot || resolve(process.env.ProgramFiles ?? "C:/Program Files", "Siemens/Automation/Portal V20/Help/en-US");
const installedPackageAllowlist = ["ProgSCL2MenUS.zip", "ProgPLCBasicsenUS.zip", "ProgExtInstr2MenUS.zip"] as const;
prepareDocumentationSources(documentationStore, {});
const documentationRetrieval = new DocumentationRetrievalService(documentationStore);
const conventionStore = new ConventionStore(resolve(dataDirectory, "conventions.sqlite"));
const conventions = new ConventionService(conventionStore);
const engineeringPolicy = getRuntimePolicy();
const engineeringClient = engineeringPolicy.mode === "tia-readonly"
  ? new (await import("./engineering-mcp-client.js")).EngineeringMcpClient({
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
    ? new (await import("./engineering-snapshot-collector.js")).EngineeringMcpSnapshotCollector(engineeringClient)
    : { collect: async () => { throw new Error("TIA read-only mode is required for engineering snapshots."); } },
  undefined,
  undefined,
  undefined,
  store,
);
let assistant: AssistantRuntime;
if (runtimeName === "fake") {
  assistant = new FakeAssistant(store);
} else {
  const [{ PiAssistant }, { EngineeringRetrievalToolProvider }, { DocumentationRetrievalToolProvider }, { ConventionToolProvider }] = await Promise.all([
    import("./pi-assistant.js"), import("./engineering-retrieval-tools.js"),
    import("./documentation-retrieval-tools.js"), import("./convention-tools.js"),
  ]);
  assistant = new PiAssistant(
    store, projectRoot, resolve(dataDirectory, "pi-sessions"), engineering,
    new EngineeringRetrievalToolProvider(engineering, snapshots, new EngineeringRetrievalService(), store),
    new DocumentationRetrievalToolProvider(documentationRetrieval), new ConventionToolProvider(conventions),
  );
}
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

let documentationWorker: Worker | null = null;
app.addHook("onClose", async () => {
  if (documentationWorker) await documentationWorker.terminate();
  documentationStore.close();
  conventionStore.close();
});

try {
  await app.listen({ host, port });
  documentationWorker = new Worker(new URL("./documentation-initialization-worker.js", import.meta.url), {
    workerData: { databasePath: documentationDatabasePath, installedRoot: installedHelpRoot, packageAllowlist: installedPackageAllowlist },
  });
  documentationWorker.once("message", () => documentationStore.reload());
  documentationWorker.once("error", () => {
    const indexing = documentationStore.listSources().find((source) => source.kind === "installed-help" && source.state === "indexing");
    if (indexing) documentationStore.updateSource({ ...indexing, state: "failed", statusNote: "Installed help initialization failed in the local worker." });
  });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
