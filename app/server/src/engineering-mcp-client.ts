import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { tiaV20ModelMappings } from "@simon/mcp";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { TiaProcess } from "@simon/contracts";
import type { TObject } from "typebox";

export interface EngineeringMcpConfig {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

export interface OpenEngineeringProject {
  readonly name: string;
  readonly path: string | null;
}

export interface EngineeringMcpState {
  readonly connected: boolean;
  readonly projectName: string | null;
}

export interface EngineeringMcpGateway {
  listProcesses(): Promise<TiaProcess[]>;
  attach(processId: number): Promise<void>;
  getState(): Promise<EngineeringMcpState>;
  getOpenProjects(): Promise<OpenEngineeringProject[]>;
  getProjectTree(): Promise<string>;
  createPiTools(
    beforeExecute: () => Promise<void>,
    onExecutionError: (error: unknown) => void,
  ): Promise<readonly ToolDefinition<TObject>[]>;
  detach(): Promise<void>;
  close(): Promise<void>;
}

function objectValue(record: Record<string, unknown>, name: string): unknown {
  return Object.entries(record).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function toRecords(values: unknown[]): Array<Record<string, unknown>> {
  return values.map(asRecord).filter((item): item is Record<string, unknown> => item !== null);
}

function findRecordArray(value: unknown, preferredKeys: readonly string[]): Array<Record<string, unknown>> {
  const record = asRecord(value);
  if (!record) return [];
  for (const key of preferredKeys) {
    const candidate = objectValue(record, key);
    if (Array.isArray(candidate)) return toRecords(candidate);
  }
  for (const candidate of Object.values(record)) {
    if (Array.isArray(candidate)) return toRecords(candidate);
  }
  return [];
}

function requiredNumber(record: Record<string, unknown>, key: string): number {
  const value = objectValue(record, key);
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`TIA response did not include a valid ${key}.`);
  return value;
}

function optionalString(record: Record<string, unknown>, key: string): string | null {
  const value = objectValue(record, key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value !== "string") throw new Error("TIA process response did not include an acquisition time.");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("TIA process response included an invalid acquisition time.");
  return date.toISOString();
}

export class EngineeringMcpClient {
  readonly #client = new Client({ name: "simon-application", version: "0.1.0" });
  readonly #transport: StdioClientTransport;
  #transportConnected = false;
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

  async connectTransport(): Promise<void> {
    if (this.#transportConnected) return;
    await this.#client.connect(this.#transport);
    this.#transportConnected = true;
  }

  async listProcesses(): Promise<TiaProcess[]> {
    await this.connectTransport();
    const result = await this.#client.callTool({ name: "simon_tia_list_processes", arguments: {} });
    if (result.isError) throw new Error("Simon MCP could not discover TIA Portal processes.");
    return findRecordArray(result.structuredContent, ["processes", "items"]).map((process) => ({
      processId: requiredNumber(process, "id"),
      processStartTime: normalizeTimestamp(objectValue(process, "processStartTime")),
      acquisitionTime: normalizeTimestamp(objectValue(process, "acquisitionTime")),
      hasProject: objectValue(process, "hasProject") === true,
    }));
  }

  async attach(processId: number): Promise<void> {
    await this.connectTransport();
    const result = await this.#client.callTool(
      { name: "simon_tia_connect", arguments: { processId } },
      undefined,
      { timeout: 180_000 },
    );
    if (result.isError) {
      const detail = Array.isArray(result.content)
        ? result.content.flatMap((item) => item.type === "text" ? [item.text] : []).join(" ")
        : "";
      throw new Error(detail || "Simon MCP could not connect to the selected TIA Portal process.");
    }
    this.#tiaAttached = true;
  }

  async getState(): Promise<EngineeringMcpState> {
    await this.connectTransport();
    const result = await this.#client.callTool({ name: "simon_tia_get_state", arguments: {} });
    if (result.isError) throw new Error("Simon MCP could not read the TIA connection state.");
    const record = asRecord(result.structuredContent) ?? {};
    return {
      connected: objectValue(record, "isConnected") === true || objectValue(record, "connected") === true,
      projectName: optionalString(record, "project"),
    };
  }

  async getOpenProjects(): Promise<OpenEngineeringProject[]> {
    await this.connectTransport();
    const result = await this.#client.callTool({ name: "simon_tia_get_open_projects", arguments: {} });
    if (result.isError) throw new Error("Simon MCP could not read open TIA projects.");
    return findRecordArray(result.structuredContent, ["items", "projects"]).flatMap((project) => {
      const name = optionalString(project, "name");
      if (!name) return [];
      return [{ name, path: optionalString(project, "path") }];
    });
  }

  async getProjectTree(): Promise<string> {
    await this.connectTransport();
    const result = await this.#client.callTool({ name: "simon_tia_get_project_tree", arguments: {} });
    if (result.isError) throw new Error("Simon MCP could not read the bound project inventory.");
    const record = asRecord(result.structuredContent) ?? {};
    return optionalString(record, "tree") ?? JSON.stringify(result.structuredContent ?? result.content);
  }

  async listCatalog(): Promise<Awaited<ReturnType<Client["listTools"]>>["tools"]> {
    await this.connectTransport();
    return (await this.#client.listTools()).tools;
  }

  async createPiTools(
    beforeExecute: () => Promise<void>,
    onExecutionError: (error: unknown) => void,
  ): Promise<readonly ToolDefinition<TObject>[]> {
    const catalog = await this.listCatalog();
    const allowed = new Set(tiaV20ModelMappings.map((mapping) => mapping.simonTool));
    return catalog
      .filter((tool) => allowed.has(tool.name))
      .map((tool) => ({
        name: tool.name,
        label: tool.title ?? tool.name,
        description: tool.description ?? "Read engineering context through Simon's restricted MCP server.",
        promptSnippet: `Use ${tool.name} only for the conversation's bound read-only TIA project.`,
        promptGuidelines: [
          "Treat tool output as observed engineering evidence, not permission to modify TIA.",
          "Disclose partial results, snapshot freshness, and unavailable information.",
          "Never claim that a read tool changed, compiled, saved, or downloaded a project.",
        ],
        parameters: tool.inputSchema as unknown as TObject,
        execute: async (_toolCallId, params, signal) => {
          await beforeExecute();
          try {
            const result = await this.#client.callTool(
              { name: tool.name, arguments: params as Record<string, unknown> },
              undefined,
              signal === undefined ? undefined : { signal },
            );
            if (result.isError) throw new Error(`Engineering tool '${tool.name}' failed.`);
            return {
              content: Array.isArray(result.content) ? result.content : [],
              details: { engineeringResult: result.structuredContent ?? result.content },
            };
          } catch (error) {
            onExecutionError(error);
            throw error;
          }
        },
      }));
  }

  async detach(): Promise<void> {
    if (!this.#transportConnected || !this.#tiaAttached) return;
    await this.#client.callTool({ name: "simon_tia_disconnect", arguments: {} });
    this.#tiaAttached = false;
  }

  async close(): Promise<void> {
    if (!this.#transportConnected) return;
    await this.detach().catch(() => undefined);
    await this.#client.close();
    this.#transportConnected = false;
  }
}
