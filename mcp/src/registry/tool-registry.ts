import type { OperatingMode } from "../policy/operating-modes.js";
import { mayExposeToModel } from "../policy/tool-policy.js";
import type { ToolDefinition } from "./tool-definition.js";

export class ToolRegistry {
  readonly #tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.#tools.has(tool.name)) throw new Error(`Tool '${tool.name}' is already registered.`);
    if (tool.name !== tool.mapping.simonTool) throw new Error(`Tool mapping mismatch for '${tool.name}'.`);
    this.#tools.set(tool.name, tool);
  }

  list(): readonly ToolDefinition[] {
    return [...this.#tools.values()];
  }

  listForModel(mode: OperatingMode): readonly ToolDefinition[] {
    return this.list().filter((tool) => mayExposeToModel(tool.policy, mode));
  }

  listForMcp(mode: OperatingMode): readonly ToolDefinition[] {
    return this.list().filter(
      (tool) => tool.policy.allowedModes.includes(mode)
        && (tool.policy.exposure === "model" || tool.policy.exposure === "host-only"),
    );
  }

  require(name: string): ToolDefinition {
    const tool = this.#tools.get(name);
    if (!tool) throw new Error(`Tool '${name}' is unclassified and denied.`);
    return tool;
  }
}
