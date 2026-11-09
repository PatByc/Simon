import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Stream } from "node:stream";

export interface McpStdioClientOptions {
  readonly executable: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
  readonly cwd?: string;
  readonly maxBufferSize?: number;
}

export class McpStdioClient {
  readonly #client = new Client({ name: "simon-engineering-connector", version: "0.1.0" });
  readonly #transport: StdioClientTransport;
  readonly #timeoutMs: number;
  #connected = false;

  constructor(options: McpStdioClientOptions & { readonly timeoutMs?: number }) {
    this.#timeoutMs = options.timeoutMs ?? 30_000;
    this.#transport = new StdioClientTransport({
      command: options.executable,
      args: [...options.args],
      env: { ...options.env },
      stderr: "pipe",
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      ...(options.maxBufferSize === undefined ? {} : { maxBufferSize: options.maxBufferSize }),
    });
  }

  get stderr(): Stream | null {
    return this.#transport.stderr;
  }

  async connect(): Promise<void> {
    if (this.#connected) return;
    await this.#client.connect(this.#transport);
    this.#connected = true;
  }

  async listTools(): Promise<readonly string[]> {
    await this.connect();
    const result = await this.#client.listTools();
    return result.tools.map((tool) => tool.name);
  }

  async callTool(name: string, args: Readonly<Record<string, unknown>>, signal?: AbortSignal, timeoutMs = this.#timeoutMs): Promise<unknown> {
    await this.connect();
    const result = await this.#client.callTool(
      { name, arguments: { ...args } },
      undefined,
      signal === undefined ? { timeout: timeoutMs } : { signal, timeout: timeoutMs },
    );
    const content = Array.isArray(result.content) ? result.content : [];
    if (result.isError) {
      const detail = content
        .filter((item): item is { type: "text"; text: string } =>
          typeof item === "object" && item !== null && item.type === "text" && typeof item.text === "string")
        .map((item) => item.text)
        .join(" ")
        .slice(0, 2_000);
      throw new Error(`Upstream MCP tool '${name}' failed${detail ? `: ${detail}` : "."}`);
    }
    if (result.structuredContent !== undefined) return result.structuredContent;
    const text = content.find(
      (item): item is { type: "text"; text: string } =>
        typeof item === "object" && item !== null && item.type === "text" && typeof item.text === "string",
    );
    if (!text) return content;
    try {
      return JSON.parse(text.text) as unknown;
    } catch {
      return text.text;
    }
  }

  async close(): Promise<void> {
    if (!this.#connected) return;
    await this.#client.close();
    this.#connected = false;
  }
}
