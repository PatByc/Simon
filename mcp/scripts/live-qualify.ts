import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tiaV20ModelMappings } from "../src/connectors/tia/v20/tool-map.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const simonServer = path.join(packageRoot, "dist", "src", "main.js");
const env = Object.fromEntries(
  ["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "TiaPortalLocation"]
    .flatMap((name) => process.env[name] === undefined ? [] : [[name, process.env[name]!]]),
);
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [simonServer],
  cwd: path.resolve(packageRoot, ".."),
  env: {
    ...env,
    SIMON_ENGINEERING_CONNECTOR: "tia-v20",
    SIMON_TIA_V20_ARTIFACT_ROOT: path.join(packageRoot, "..", "data", "mcp-artifacts"),
  },
  stderr: "pipe",
  maxBufferSize: 10_000_000,
});
transport.stderr?.on("data", (chunk) => process.stderr.write(chunk));
const client = new Client({ name: "simon-live-qualification", version: "0.1.0" });
await client.connect(transport);
try {
  const catalog = await client.listTools();
  const names = new Set(catalog.tools.map((tool) => tool.name));
  const expectedModelTools = tiaV20ModelMappings.map((mapping) => mapping.simonTool);
  const missing = expectedModelTools.filter((name) => !names.has(name));
  const forbiddenPresent = ["SaveProject", "ImportBlock", "CompileSoftware", "simon_tia_save_project"].filter((name) => names.has(name));
  if (missing.length || forbiddenPresent.length) throw new Error(`Catalog mismatch; missing=${missing.join(",")}; forbidden=${forbiddenPresent.join(",")}`);

  const configuredProcessId = Number(process.env.SIMON_TIA_PROCESS_ID ?? "");
  let processId = Number.isSafeInteger(configuredProcessId) && configuredProcessId > 0 ? configuredProcessId : undefined;
  let processSummary: Array<{ id?: number; hasProject?: boolean }> = [];
  if (processId === undefined) {
    const discovered = await client.callTool({ name: "simon_tia_list_processes", arguments: {} });
    const data = discovered.structuredContent as Record<string, unknown> | undefined;
    const processes = data === undefined
      ? []
      : Object.values(data).find((value): value is Array<Record<string, unknown>> => Array.isArray(value)) ?? [];
    processSummary = processes.map((process) => ({
      id: Object.entries(process).find(([key]) => key.toLowerCase() === "id")?.[1] as number | undefined,
      hasProject: Object.entries(process).find(([key]) => key.toLowerCase() === "hasproject")?.[1] as boolean | undefined,
    }));
    const selected = processes.find((process) =>
      Object.entries(process).some(([key, value]) => key.toLowerCase() === "hasproject" && value === true));
    const idEntry = selected && Object.entries(selected).find(([key]) => key.toLowerCase() === "id");
    if (typeof idEntry?.[1] === "number") processId = idEntry[1];
  }
  const connectionArguments = processId === undefined ? {} : { processId };
  const connect = await client.callTool({ name: "simon_tia_connect", arguments: connectionArguments }, undefined, { timeout: 120_000 });
  if (connect.isError) throw new Error(`Host-controlled TIA connection failed: ${JSON.stringify(connect.content)}`);
  const state = await client.callTool({ name: "simon_tia_get_state", arguments: {} });
  const projects = await client.callTool({ name: "simon_tia_get_open_projects", arguments: {} });
  const projectData = projects.structuredContent as Record<string, unknown> | undefined;
  const projectArray = projectData === undefined
    ? undefined
    : Object.values(projectData).find((value): value is unknown[] => Array.isArray(value));
  if (projectArray?.length === 0) {
    throw new Error(`TIA connection succeeded, but the attached TIA process has no open local project. Discovery=${JSON.stringify(processSummary)} selected=${processId ?? "automatic"}`);
  }
  const tree = await client.callTool({ name: "simon_tia_get_project_tree", arguments: {} }, undefined, { timeout: 240_000 });
  if (state.isError || projects.isError || tree.isError) {
    throw new Error(`Live reads failed: ${JSON.stringify({ state: state.isError ? state.content : "ok", projects: projects.isError ? projects.content : "ok", projectShape: projectData === undefined ? [] : Object.keys(projectData), projectCount: projectArray?.length, tree: tree.isError ? tree.content : "ok" })}`);
  }

  let denied = false;
  try {
    const forbidden = await client.callTool({ name: "SaveProject", arguments: {} });
    denied = forbidden.isError === true;
  } catch {
    denied = true;
  }
  if (!denied) throw new Error("Unclassified raw upstream tool was not denied.");

  console.log(JSON.stringify({
    qualified: true,
    exposedToolCount: names.size,
    modelToolCount: expectedModelTools.length,
    hostToolCount: 3,
    stateRead: true,
    projectListRead: true,
    projectTreeRead: true,
    unclassifiedToolDenied: true,
  }, null, 2));

  await client.callTool({ name: "simon_tia_disconnect", arguments: {} }).catch(() => undefined);
} finally {
  await client.close();
}
