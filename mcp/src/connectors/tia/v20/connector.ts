import { createHash } from "node:crypto";

import type { ConnectorCapability, ConnectorIdentity, EngineeringConnector } from "../../connector.js";
import { unsupportedCapability } from "../../errors.js";
import { McpStdioClient } from "../../process/mcp-stdio-client.js";
import type { McpRequestContext } from "../../../server/request-context.js";
import { tiaV20ToolMap } from "./tool-map.js";

export interface TiaV20ConnectorOptions {
  readonly executable: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
}

const argumentAliases: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "tia.analysis.dbMembers": { pattern: "dbNameRegex" },
  "tia.analysis.parameterDbs": { pattern: "dbNameRegex" },
  "tia.analysis.analogInputs": { pattern: "blockNameRegex" },
  "tia.analysis.analogOutputs": { pattern: "blockNameRegex" },
};

export class TiaV20Connector implements EngineeringConnector {
  readonly identity: ConnectorIdentity;
  readonly #client: McpStdioClient;
  readonly #byOperation = new Map(tiaV20ToolMap.map((mapping) => [mapping.connectorOperation, mapping]));
  #discovered = new Set<string>();
  #projectSignature: string | null = null;

  constructor(options: TiaV20ConnectorOptions) {
    this.identity = {
      kind: "tia-v20",
      version: "20",
      implementation: "simon-incorporated-tia-v20-worker",
      provenance: {
        upstream: "Fanqi-dev/tia-v20-unified-mcp@ad235bb009145e1d8acc38b604a401f5906ff8d9",
        source: "Simon/mcp/worker/tia/v20",
      },
    };
    this.#client = new McpStdioClient({
      executable: options.executable,
      args: ["--tia-major-version", "20", "--logging", "stderr", "--transport", "stdio"],
      env: options.env ?? {},
      maxBufferSize: 10_000_000,
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    });
  }

  async initialize(): Promise<void> {
    this.#discovered = new Set(await this.#client.listTools());
  }

  listCapabilities(): readonly ConnectorCapability[] {
    return tiaV20ToolMap.map((mapping) => ({
      name: mapping.connectorOperation,
      available: this.#discovered.has(mapping.upstreamTool),
      ...(this.#discovered.has(mapping.upstreamTool) ? {} : { reason: `Upstream tool '${mapping.upstreamTool}' was not discovered.` }),
    }));
  }

  supports(capability: string): boolean {
    const mapping = this.#byOperation.get(capability);
    return mapping !== undefined && this.#discovered.has(mapping.upstreamTool);
  }

  async invoke<TInput, TOutput>(capability: string, input: TInput, context: McpRequestContext): Promise<TOutput> {
    const mapping = this.#byOperation.get(capability);
    if (!mapping || !this.supports(capability)) throw unsupportedCapability(capability);
    if (mapping.requiresProjectBinding) await this.#verifyProjectBinding(context.signal);
    const raw = typeof input === "object" && input !== null ? input as Record<string, unknown> : {};
    const aliases = argumentAliases[capability] ?? {};
    const args = Object.fromEntries(Object.entries(raw).map(([key, value]) => [aliases[key] ?? key, value]));
    const result = await this.#client.callTool(mapping.upstreamTool, args, context.signal, mapping.timeoutMs) as TOutput;
    if (capability === "tia.project.listOpen") this.#projectSignature = this.#signature(result);
    return result;
  }

  async close(): Promise<void> {
    await this.#client.close();
  }

  async #verifyProjectBinding(signal?: AbortSignal): Promise<void> {
    const current = await this.#client.callTool("GetProject", {}, signal);
    const signature = this.#signature(current);
    if (this.#projectSignature === null) {
      this.#projectSignature = signature;
      return;
    }
    if (signature !== this.#projectSignature) {
      throw new Error("The active TIA project changed; rebind the Simon conversation before continuing.");
    }
  }

  #signature(value: unknown): string {
    const stable = (item: unknown): unknown => {
      if (Array.isArray(item)) return item.map(stable);
      if (typeof item !== "object" || item === null) return item;
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>)
          .filter(([key]) => !["meta", "timestamp"].includes(key.toLowerCase()))
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, stable(child)]),
      );
    };
    return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
  }
}
