import { createHash, randomUUID } from "node:crypto";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import {
  engineeringCapabilitiesSchema,
  engineeringDiagnosticsSchema,
  engineeringInventorySchema,
  engineeringProcessListSchema,
  engineeringStatusSchema,
  type EngineeringCapabilities,
  type EngineeringDiagnostics,
  type EngineeringInventory,
  type EngineeringStatus,
  type ProjectBinding,
  type TiaProcess,
} from "@simon/contracts";
import type { TObject } from "typebox";
import type { EngineeringMcpGateway } from "./engineering-mcp-client.js";
import type { RuntimePolicy } from "./runtime-policy.js";
import type { InMemoryStore } from "./store.js";

export interface EngineeringConnection {
  getStatus(conversationId?: string): EngineeringStatus;
  listProcesses(): Promise<{ processes: TiaProcess[]; observedAt: string }>;
  attach(conversationId: string, target: { processId: number; processStartTime: string }): Promise<ProjectBinding>;
  detach(): Promise<void>;
  getCapabilities(): EngineeringCapabilities;
  getDiagnostics(): EngineeringDiagnostics;
  getInventory(conversationId: string): Promise<EngineeringInventory>;
  createPiTools(conversationId: string): Promise<readonly ToolDefinition<TObject>[]>;
  close(): Promise<void>;
}

const liveTestedTools = new Set([
  "simon_tia_get_state",
  "simon_tia_get_open_projects",
  "simon_tia_get_project_tree",
]);

function capabilityLabel(name: string): string {
  return name
    .replace(/^simon_tia_/, "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export class EngineeringConnectionManager implements EngineeringConnection {
  readonly #client: EngineeringMcpGateway | null;
  #state: EngineeringStatus["state"];
  #activeBinding: ProjectBinding | null = null;
  #reason: string | undefined;
  #lastProcesses: TiaProcess[] | null = null;
  #observedAt = new Date().toISOString();
  #lifecycleQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: InMemoryStore,
    private readonly policy: RuntimePolicy,
    client: EngineeringMcpGateway | null,
  ) {
    this.#client = client;
    this.#state = policy.mode === "tia-readonly" ? "disconnected" : "disabled";
  }

  getStatus(conversationId?: string): EngineeringStatus {
    const conversationBinding = conversationId
      ? this.store.conversations.get(conversationId)?.projectBinding ?? null
      : this.#activeBinding;
    return engineeringStatusSchema.parse({
      mode: this.policy.mode,
      state: this.#state,
      binding: this.#activeBinding,
      conversationBindingMatches: this.#activeBinding !== null
        && conversationBinding?.bindingId === this.#activeBinding.bindingId
        && conversationBinding.epoch === this.#activeBinding.epoch,
      ...(this.#reason ? { reason: this.#reason } : {}),
      observedAt: this.#observedAt,
    });
  }

  async listProcesses(): Promise<{ processes: TiaProcess[]; observedAt: string }> {
    return this.#enqueueLifecycle(async () => {
      const client = this.#requireClient();
      this.#setState("discovering");
      try {
        const processes = await client.listProcesses();
        this.#lastProcesses = processes;
        this.#setState(this.#activeBinding ? "connected" : "disconnected");
        return engineeringProcessListSchema.parse({ processes, observedAt: this.#observedAt });
      } catch (error) {
        this.#fail(error);
        throw error;
      }
    });
  }

  async attach(conversationId: string, target: { processId: number; processStartTime: string }): Promise<ProjectBinding> {
    return this.#enqueueLifecycle(async () => {
    const conversation = this.store.conversations.get(conversationId);
    if (!conversation) throw new Error("Conversation not found.");
    if (conversation.status === "running") throw new Error("Stop the active response before changing engineering context.");
    if (conversation.projectBinding && (
      conversation.projectBinding.processId !== target.processId
      || conversation.projectBinding.processStartTime !== target.processStartTime
    )) {
      throw new Error("This conversation is already bound to another engineering target. Start a new conversation to select a different project.");
    }
    if (this.#activeBinding && (
      this.#activeBinding.processId !== target.processId
      || this.#activeBinding.processStartTime !== target.processStartTime
    )) {
      throw new Error("Disconnect the current TIA target before selecting another process.");
    }

    const client = this.#requireClient();
    this.#setState("connecting");
    try {
      const processes = await client.listProcesses();
      this.#lastProcesses = processes;
      const selected = processes.find((process) =>
        process.processId === target.processId && process.processStartTime === target.processStartTime);
      if (!selected) throw new Error("The selected TIA process changed or exited. Refresh the process list and select it again.");
      if (!selected.hasProject) throw new Error("The selected TIA process does not currently report an open project.");

      await client.attach(selected.processId);
      const [state, projects] = await Promise.all([client.getState(), client.getOpenProjects()]);
      if (!state.connected || !state.projectName || state.projectName === "-") {
        await client.detach().catch(() => undefined);
        throw new Error("Simon attached to TIA Portal, but no current project could be bound.");
      }
      const matchingProjects = projects.filter((project) => project.name === state.projectName);
      if (matchingProjects.length > 1) {
        await client.detach().catch(() => undefined);
        throw new Error("Multiple open projects have the same name, so Simon cannot establish an unambiguous binding.");
      }
      const project = matchingProjects[0] ?? (projects.length === 1 ? projects[0] : undefined);
      if (!project) {
        await client.detach().catch(() => undefined);
        throw new Error("Simon could not match the active TIA project to the open-project inventory.");
      }

      const binding: ProjectBinding = {
        bindingId: conversation.projectBinding?.bindingId ?? randomUUID(),
        epoch: randomUUID(),
        processId: selected.processId,
        processStartTime: selected.processStartTime,
        projectName: project.name,
        projectPathHash: createHash("sha256")
          .update(project.path ?? `${selected.processId}:${selected.processStartTime}:${project.name}`)
          .digest("hex"),
        observedAt: new Date().toISOString(),
      };
      this.#activeBinding = binding;
      this.store.updateConversation(conversationId, { projectBinding: binding });
      this.#setState("connected");
      return binding;
    } catch (error) {
      await client.detach().catch(() => undefined);
      this.#activeBinding = null;
      this.#fail(error);
      throw error;
    }
    });
  }

  async detach(): Promise<void> {
    return this.#enqueueLifecycle(async () => {
      if (!this.#client) return;
      await this.#client.detach();
      this.#activeBinding = null;
      this.#setState(this.policy.mode === "tia-readonly" ? "disconnected" : "disabled");
    });
  }

  getCapabilities(): EngineeringCapabilities {
    const available = this.policy.mode === "tia-readonly";
    return engineeringCapabilitiesSchema.parse({
      capabilities: [
        ...this.policy.allowedTools.map((tool) => ({
          capability: tool,
          label: capabilityLabel(tool),
          status: available ? (liveTestedTools.has(tool) ? "live-tested" : "fake-tested") : "disabled",
          available,
          note: available
            ? liveTestedTools.has(tool)
              ? "Invoked successfully on the target TIA V20 environment."
              : "Implemented and deterministic-test qualified; operation-specific live qualification remains pending."
            : "TIA integration is disabled in synthetic mode.",
        })),
        {
          capability: "tia.project.mutation",
          label: "Project mutation",
          status: "disabled",
          available: false,
          note: "Import, compile, save, project lifecycle mutation, and online PLC operations are blocked.",
        },
      ],
      observedAt: new Date().toISOString(),
    });
  }

  getDiagnostics(): EngineeringDiagnostics {
    return engineeringDiagnosticsSchema.parse({
      mode: this.policy.mode,
      piIntegration: "sdk",
      piPackageVersion: "1.5.0",
      mcpPackageVersion: "0.1.0",
      connector: this.policy.mode === "tia-readonly" ? "tia-v20" : "simulated",
      tiaMajorVersion: this.policy.mode === "tia-readonly" ? 20 : null,
      workerAvailable: this.#client !== null,
      modelToolCount: this.policy.allowedTools.length,
      hostToolCount: this.policy.mode === "tia-readonly" ? 3 : 0,
      processCount: this.#lastProcesses?.length ?? null,
      activeBinding: this.#activeBinding,
      warnings: [
        ...(this.#activeBinding ? [] : ["No active TIA project binding."]),
        "Hardware and software inventory coverage is bounded and may be partial.",
        "Project mutation capabilities are disabled.",
      ],
      observedAt: new Date().toISOString(),
    });
  }

  async getInventory(conversationId: string): Promise<EngineeringInventory> {
    await this.#assertBound(conversationId);
    const projectTree = await this.#requireClient().getProjectTree();
    return engineeringInventorySchema.parse({
      binding: this.#activeBinding,
      observedAt: new Date().toISOString(),
      projectTree,
      partial: true,
      coverage: [
        "Project hierarchy is read through the qualified project-tree operation.",
        "Nested hardware visibility can be incomplete and is reported as partial.",
        "Block source, tags, references, and HMI inventory are outside M1 coverage.",
      ],
    });
  }

  async createPiTools(conversationId: string): Promise<readonly ToolDefinition<TObject>[]> {
    const client = this.#requireClient();
    return client.createPiTools(
      () => this.#assertBound(conversationId),
      (error) => {
        const message = error instanceof Error ? error.message : "Engineering tool failed.";
        if (/project changed|rebind|disposed|not connected/i.test(message)) {
          this.#reason = message;
          this.#state = "stale";
          this.#observedAt = new Date().toISOString();
        }
      },
    );
  }

  async close(): Promise<void> {
    return this.#enqueueLifecycle(async () => {
      await this.#client?.close();
      this.#activeBinding = null;
    });
  }

  async #assertBound(conversationId: string): Promise<void> {
    const conversation = this.store.conversations.get(conversationId);
    if (!conversation?.projectBinding) throw new Error("Connect this conversation to a TIA project before using engineering tools.");
    if (!this.#activeBinding) throw new Error("The saved project binding is disconnected. Reconnect it before using engineering tools.");
    if (
      conversation.projectBinding.bindingId !== this.#activeBinding.bindingId
      || conversation.projectBinding.epoch !== this.#activeBinding.epoch
    ) {
      throw new Error("The conversation's engineering binding is stale. Reconnect before continuing.");
    }
  }

  #enqueueLifecycle<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#lifecycleQueue.then(operation, operation);
    this.#lifecycleQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  #requireClient(): EngineeringMcpGateway {
    if (!this.#client || this.policy.mode !== "tia-readonly") {
      throw new Error("TIA read-only mode is not enabled for this Simon process.");
    }
    return this.#client;
  }

  #setState(state: EngineeringStatus["state"]): void {
    this.#state = state;
    this.#reason = undefined;
    this.#observedAt = new Date().toISOString();
  }

  #fail(error: unknown): void {
    this.#state = "failed";
    this.#reason = error instanceof Error ? error.message : "Engineering connection failed.";
    this.#observedAt = new Date().toISOString();
  }
}
