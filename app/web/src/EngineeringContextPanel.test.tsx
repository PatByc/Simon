import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Conversation } from "@simon/contracts";
import { EngineeringContextPanel } from "./EngineeringContextPanel.js";

const conversation: Conversation = {
  conversationId: "8afc901e-777c-4f9f-bfac-1727efb1f66d",
  piSessionId: null,
  title: "Engineering",
  createdAt: "2026-11-09T10:00:00.000Z",
  updatedAt: "2026-11-09T10:00:00.000Z",
  selectedModel: null,
  thinkingLevel: null,
  approvalMode: "manual",
  status: "idle",
  projectBinding: null,
};

const capabilities = {
  capabilities: [{
    capability: "simon_tia_get_state",
    label: "Get State",
    status: "live-tested",
    available: true,
    note: "Qualified",
  }],
  observedAt: "2026-11-09T10:00:00.000Z",
};

const diagnostics = {
  mode: "tia-readonly",
  piIntegration: "sdk",
  piPackageVersion: "1.5.0",
  mcpPackageVersion: "0.1.0",
  connector: "tia-v20",
  tiaMajorVersion: 20,
  workerAvailable: true,
  modelToolCount: 18,
  hostToolCount: 3,
  processCount: null,
  activeBinding: null,
  warnings: [],
  observedAt: "2026-11-09T10:00:00.000Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("EngineeringContextPanel", () => {
  it("discovers an explicit process and attaches read only", async () => {
    let connected = false;
    const binding = {
      bindingId: "d07f4af7-95a5-467c-89f5-ded7bc703b62",
      epoch: "5df7d2e5-1c72-4aaf-b98a-cf8525538950",
      processId: 42,
      processStartTime: "2026-11-09T09:00:00.000Z",
      projectName: "Plant",
      projectPathHash: "a".repeat(64),
      observedAt: "2026-11-09T10:00:00.000Z",
    };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      let body: unknown;
      if (url.includes("/engineering/status")) body = {
        mode: "tia-readonly",
        state: connected ? "connected" : "disconnected",
        binding: connected ? binding : null,
        conversationBindingMatches: connected,
        observedAt: "2026-11-09T10:00:00.000Z",
      };
      else if (url.endsWith("/engineering/capabilities")) body = capabilities;
      else if (url.endsWith("/engineering/diagnostics")) body = { ...diagnostics, activeBinding: connected ? binding : null };
      else if (url.endsWith("/engineering/processes")) body = {
        processes: [{
          processId: 42,
          processStartTime: binding.processStartTime,
          acquisitionTime: "2026-11-09T10:00:00.000Z",
          hasProject: true,
        }],
        observedAt: "2026-11-09T10:00:00.000Z",
      };
      else if (url.includes("/engineering-binding") && init?.method === "POST") {
        connected = true;
        body = binding;
      } else throw new Error(`Unexpected request: ${url}`);
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    const onBindingChange = vi.fn();
    render(<EngineeringContextPanel conversation={conversation} onBindingChange={onBindingChange} />);

    fireEvent.click(await screen.findByRole("button", { name: "Discover TIA processes" }));
    await screen.findByRole("option", { name: /PID 42/ });
    fireEvent.click(screen.getByRole("button", { name: "Connect read only" }));

    await waitFor(() => expect(onBindingChange).toHaveBeenCalledWith(binding));
    expect((await screen.findAllByText("Plant")).length).toBeGreaterThan(0);
    expect(screen.getByText("Read only")).toBeInTheDocument();
  });
});
