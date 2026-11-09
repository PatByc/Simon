import type { ConnectorCapability, ConnectorIdentity, EngineeringConnector } from "../connectors/connector.js";
import { unsupportedCapability } from "../connectors/errors.js";
import type { McpRequestContext } from "../server/request-context.js";

export class FakeEngineeringConnector implements EngineeringConnector {
  readonly identity: ConnectorIdentity = {
    kind: "tia-simulated",
    version: "1",
    implementation: "Simon deterministic test connector",
  };
  readonly #responses: ReadonlyMap<string, unknown>;

  constructor(responses: Readonly<Record<string, unknown>> = {}) {
    this.#responses = new Map(Object.entries(responses));
  }

  listCapabilities(): readonly ConnectorCapability[] {
    return [...this.#responses.keys()].map((name) => ({ name, available: true }));
  }

  supports(capability: string): boolean {
    return this.#responses.has(capability);
  }

  async invoke<TInput, TOutput>(capability: string, _input: TInput, context: McpRequestContext): Promise<TOutput> {
    if (context.signal.aborted) throw new Error("Operation cancelled.");
    if (!this.supports(capability)) throw unsupportedCapability(capability);
    return this.#responses.get(capability) as TOutput;
  }

  async close(): Promise<void> {}
}
