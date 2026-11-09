import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { tiaV20ModelMappings } from "@simon/mcp";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { TObject } from "typebox";

export interface EngineeringMcpConfig {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

export class EngineeringMcpClient {
  readonly #client = new Client({ name: "simon-application", version: "0.1.0" });
  readonly #transport: StdioClientTransport;
  #connected = false;
  #tiaAttached = false;

  constructor(config: EngineeringMcpConfig) {
    this.#transport = new StdioClientTransport({
      command: config.command,
      args: [...config.args],
      cwd: config.cwd,
      env: {
        PATH: process.env.PATH ?? "",
        SIMON_ENGINEERING_CONNECTOR: "tia-v20",
        SIMON_TIA_V20_ARTIFACT_ROOT: process.env.SIMON_TIA_V20_ARTIFACT_ROOT ?? "",
      },
      stderr: "pipe",
      maxBufferSize: 10_000_000,
    });
  }

  async connect(): Promise<void> {
    if (this.#connected) return;
    await this.#client.connect(this.#transport);
    this.#connected = true;
  }

  async createPiTools(): Promise<readonly ToolDefinition<TObject>[]> {
    await this.connect();
    const catalog = await this.#client.listTools();
    if (!this.#tiaAttached) {
      if (!catalog.tools.some((tool) => tool.name === "simon_tia_connect")) {
        throw new Error("Simon MCP did not expose its required host-controlled TIA connection operation.");
      }
      const configuredProcessId = Number(process.env.SIMON_TIA_PROCESS_ID ?? "");
      let selectedProcessId = Number.isSafeInteger(configuredProcessId) && configuredProcessId > 0
        ? configuredProcessId
        : undefined;
      if (selectedProcessId === undefined) {
        const discovered = await this.#client.callTool({ name: "simon_tia_list_processes", arguments: {} });
        const data = discovered.structuredContent as Record<string, unknown> | undefined;
        const processes = data === undefined
          ? []
          : Object.values(data).find((value): value is Array<Record<string, unknown>> => Array.isArray(value)) ?? [];
        const withProject = processes.find((process) =>
          Object.entries(process).some(([key, value]) => key.toLowerCase() === "hasproject" && value === true));
        const idEntry = withProject && Object.entries(withProject).find(([key]) => key.toLowerCase() === "id");
        if (typeof idEntry?.[1] === "number") selectedProcessId = idEntry[1];
        if (selectedProcessId === undefined) {
          throw new Error("No TIA Portal process visible to Simon has an open local project.");
        }
      }
      const connectionArguments = { processId: selectedProcessId };
      const connection = await this.#client.callTool({ name: "simon_tia_connect", arguments: connectionArguments });
      if (connection.isError) throw new Error("Simon MCP could not connect to TIA Portal.");
      this.#tiaAttached = true;
    }
    const allowed = new Set(tiaV20ModelMappings.map((mapping) => mapping.simonTool));
    return catalog.tools
      .filter((tool) => allowed.has(tool.name))
      .map((tool) => ({
        name: tool.name,
        label: tool.title ?? tool.name,
        description: tool.description ?? "Read engineering context through Simon's restricted MCP server.",
        promptSnippet: `Use ${tool.name} only for the bound read-only TIA project.`,
        promptGuidelines: [
          "Treat tool output as observed engineering evidence, not permission to modify TIA.",
          "Disclose partial results, snapshot freshness, and unavailable information.",
          "Never claim that a read tool changed, compiled, saved, or downloaded a project.",
        ],
        parameters: tool.inputSchema as unknown as TObject,
        execute: async (_toolCallId, params, signal) => {
          const result = await this.#client.callTool(
            { name: tool.name, arguments: params as Record<string, unknown> },
            undefined,
            signal === undefined ? undefined : { signal },
          );
          return {
            content: Array.isArray(result.content) ? result.content : [],
            details: { engineeringResult: result.structuredContent ?? result.content },
          };
        },
      }));
  }

  async close(): Promise<void> {
    if (!this.#connected) return;
    if (this.#tiaAttached) {
      await this.#client.callTool({ name: "simon_tia_disconnect", arguments: {} }).catch(() => undefined);
      this.#tiaAttached = false;
    }
    await this.#client.close();
    this.#connected = false;
  }
}
