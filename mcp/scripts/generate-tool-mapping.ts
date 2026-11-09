import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { tiaV20ToolMap } from "../src/connectors/tia/v20/tool-map.js";

const liveCalled = new Set([
  "GetPortalProcesses",
  "Connect",
  "Disconnect",
  "GetState",
  "GetProject",
  "GetProjectTree",
]);

const rows = tiaV20ToolMap.map((item) => {
  const status = liveCalled.has(item.upstreamTool)
    ? "live-tested"
    : item.exposure === "model"
      ? "fake-tested; live catalog-qualified"
      : item.exposure === "blocked" || item.exposure === "internal"
        ? "denied by façade"
        : "implemented";
  return `| \`${item.upstreamTool}\` | \`${item.connectorOperation}\` | ${item.simonTool ? `\`${item.simonTool}\`` : "—"} | ${item.effect} | ${item.exposure} | ${item.requiresConnection ? "yes" : "no"} | ${item.requiresProjectBinding ? "yes" : "no"} | ${item.createsArtifacts ? "yes" : "no"} | ${status} |`;
});

const markdown = `# Simon MCP Tool Mapping

Generated from \`src/connectors/tia/v20/tool-map.ts\`. Unclassified upstream tools are denied.

| TIA V20 upstream tool | Connector operation | Simon MCP tool | Effect | Exposure | Connection | Project binding | Artifacts | Live status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join("\n")}
`;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await writeFile(path.join(root, "TOOL_MAPPING.md"), markdown);
