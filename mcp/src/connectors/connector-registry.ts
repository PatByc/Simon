import type { EngineeringConnector } from "./connector.js";

export class ConnectorRegistry {
  readonly #connectors = new Map<string, EngineeringConnector>();

  register(name: string, connector: EngineeringConnector): void {
    if (this.#connectors.has(name)) throw new Error(`Connector '${name}' is already registered.`);
    this.#connectors.set(name, connector);
  }

  get(name: string): EngineeringConnector | undefined {
    return this.#connectors.get(name);
  }

  require(name: string): EngineeringConnector {
    const connector = this.get(name);
    if (!connector) throw new Error(`Connector '${name}' is not registered.`);
    return connector;
  }
}
