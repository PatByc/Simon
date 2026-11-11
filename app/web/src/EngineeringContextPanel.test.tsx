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
      else if (url.includes("/engineering-snapshot")) body = { snapshot: null };
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

  it("creates a snapshot and renders cited search results with freshness", async () => {
    const binding = {
      bindingId: "d07f4af7-95a5-467c-89f5-ded7bc703b62",
      epoch: "5df7d2e5-1c72-4aaf-b98a-cf8525538950",
      processId: 42,
      processStartTime: "2026-11-09T09:00:00.000Z",
      projectName: "Plant",
      projectPathHash: "a".repeat(64),
      observedAt: "2026-11-09T10:00:00.000Z",
    };
    const boundConversation = { ...conversation, projectBinding: binding };
    const snapshot = {
      snapshotId: "11111111-1111-4111-8111-111111111111",
      conversationId: conversation.conversationId,
      binding,
      state: "partial",
      freshness: "current",
      staleReason: null,
      createdAt: "2026-11-09T10:01:00.000Z",
      updatedAt: "2026-11-09T10:02:00.000Z",
      completedAt: "2026-11-09T10:02:00.000Z",
      objectCount: 4,
      byteCount: 1024,
      documentCount: 1,
      limits: { maxObjects: 100, maxBytes: 10000, maxDurationMs: 30000, maxResultsPerQuery: 20 },
      coverage: [{ capability: "tia.block.collection", state: "partial", observedCount: 1, note: "One format is partial." }],
    };
    let currentSnapshot: typeof snapshot | null = null;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      let body: unknown;
      if (url.includes("/engineering/status")) body = { mode: "tia-readonly", state: "connected", binding, conversationBindingMatches: true, observedAt: binding.observedAt };
      else if (url.endsWith("/engineering/capabilities")) body = capabilities;
      else if (url.endsWith("/engineering/diagnostics")) body = { ...diagnostics, activeBinding: binding };
      else if (url.includes("/engineering-snapshot") && init?.method === "POST") { currentSnapshot = snapshot; body = snapshot; }
      else if (url.includes("/engineering-snapshot")) body = { snapshot: currentSnapshot };
      else if (url.includes("/engineering-search")) body = {
        snapshot,
        query: "restart delay",
        hits: [{
          document: {
            documentId: "b".repeat(64), snapshotId: snapshot.snapshotId, kind: "block", name: "Main",
            engineeringPath: "Program blocks/Main", parentPath: "Program blocks", language: "SCL",
            contentDigest: "c".repeat(64), contentLength: 20, artifactId: null, excerpt: "restart delay",
            attributes: {}, provenance: { snapshotId: snapshot.snapshotId, bindingId: binding.bindingId, bindingEpoch: binding.epoch, observedAt: snapshot.updatedAt, sourceOperation: "tia.block.export", coverage: "complete" },
          },
          matchKind: "lexical",
          score: 0.8,
          snippet: "Restart delay is five seconds.",
          citation: { citationId: "d".repeat(64), snapshotId: snapshot.snapshotId, documentId: "b".repeat(64), engineeringPath: "Program blocks/Main", observedAt: snapshot.updatedAt, freshness: "current", coverage: "complete" },
        }],
        partial: true,
        coverage: snapshot.coverage,
      };
      else throw new Error(`Unexpected request: ${url}`);
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    render(<EngineeringContextPanel conversation={boundConversation} onBindingChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Create snapshot" }));
    expect(await screen.findByText("current")).toBeInTheDocument();
    expect(screen.getByText(/1 documents · 4 objects/)).toBeInTheDocument();
    expect(screen.getByText("Coverage notes").parentElement).toHaveTextContent("One format is partial.");

    fireEvent.change(screen.getByLabelText("Search current snapshot"), { target: { value: "restart delay" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Restart delay is five seconds.")).toBeInTheDocument();
    expect(screen.getByText("Program blocks/Main")).toBeInTheDocument();
    expect(screen.getByText(/lexical · complete/)).toBeInTheDocument();
  });
});
