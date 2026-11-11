import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App.js";
import { useAssistantUi } from "./store.js";

beforeEach(() => {
  localStorage.removeItem("simon-sidebar-collapsed");
  localStorage.removeItem("simon-draft:new");
  useAssistantUi.setState({ isOpen: false, isPinned: false, approvalMode: "manual" });
  vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.endsWith("/api/v1/usage")
      ? { available: false, reason: "Test usage unavailable", checkedAt: "2026-11-07T14:30:00.000Z" }
      : url.includes("/conversations")
        ? { conversations: [] }
        : {
          available: true,
          runtime: "fake",
          modelCount: 1,
          capabilities: { tools: [], externalAccess: false, mutations: false, scope: "Test runtime" },
        };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Simon chat application", () => {
  it("renders the chat as the full application interface", async () => {
    render(<MemoryRouter><App /></MemoryRouter>);

    expect(screen.getByRole("region", { name: "Simon assistant" })).toBeVisible();
    await waitFor(() => expect(screen.getByLabelText("Message Simon")).toHaveFocus());
    expect(screen.getByRole("button", { name: "New conversation" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Conversation history" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Settings" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Conversations" })).toBeVisible();
  });

  it("collapses and restores the conversation sidebar preference", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><App /></MemoryRouter>);

    await user.click(screen.getByRole("button", { name: "Collapse conversation sidebar" }));
    expect(localStorage.getItem("simon-sidebar-collapsed")).toBe("true");
    expect(screen.getByRole("button", { name: "Expand conversation sidebar" })).toBeVisible();
  });

  it("shows slash commands and executes local help", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><App /></MemoryRouter>);

    await user.type(screen.getByLabelText("Message Simon"), "/help");

    expect(screen.getByRole("listbox", { name: "Commands" })).toBeVisible();
    await user.keyboard("{Enter}");
    expect(await screen.findByText(/\/new — Start a new conversation/)).toBeVisible();
  });

  it("restores an unsent draft after remounting", async () => {
    const user = userEvent.setup();
    const first = render(<MemoryRouter><App /></MemoryRouter>);
    await user.type(screen.getByLabelText("Message Simon"), "Unsent engineering note");
    expect(localStorage.getItem("simon-draft:new")).toBe("Unsent engineering note");
    first.unmount();

    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.getByLabelText("Message Simon")).toHaveValue("Unsent engineering note");
  });

  it("supports keyboard navigation in the command palette", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><App /></MemoryRouter>);

    const composer = screen.getByLabelText("Message Simon");
    await user.type(composer, "/");
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox", { name: "Commands" })).not.toBeInTheDocument();
  });

  it("persists the selected execution preference", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><App /></MemoryRouter>);

    await user.click(screen.getByRole("button", { name: "Execution mode: Manual" }));
    await user.click(screen.getByRole("menuitemradio", { name: /Auto execute/ }));

    expect(useAssistantUi.getState().approvalMode).toBe("auto");
    expect(screen.getByRole("button", { name: "Execution mode: Auto" })).toBeVisible();
    expect(screen.queryByText("Auto applies safe local/demo actions only")).not.toBeInTheDocument();
  });

  it("embeds OpenAI and Claude model pages in the composer", async () => {
    const user = userEvent.setup();
    const conversation = {
      conversationId: "8afc901e-777c-4f9f-bfac-1727efb1f66d",
      piSessionId: null,
      title: "New conversation",
      createdAt: "2026-11-07T14:30:00.000Z",
      updatedAt: "2026-11-07T14:30:00.000Z",
      selectedModel: null,
      thinkingLevel: null,
      approvalMode: "manual",
      status: "idle",
    };
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      let body: unknown;
      if (url.endsWith("/api/v1/usage")) body = { available: false, reason: "Unavailable", checkedAt: "2026-11-07T14:30:00.000Z" };
      else if (url.endsWith("/api/v1/assistant/status")) body = { available: true, runtime: "pi", modelCount: 1, capabilities: { tools: [], externalAccess: false, mutations: false, scope: "Test runtime" } };
      else if (url.endsWith("/api/v1/conversations") && init?.method === "POST") body = conversation;
      else if (url.endsWith("/api/v1/conversations")) body = { conversations: [] };
      else if (url.endsWith("/runtime")) body = {
        activeModel: "openai/gpt-test",
        thinkingLevel: "medium",
        models: [{ provider: "openai", id: "gpt-test", name: "GPT Test", reasoning: true }],
        thinkingLevels: ["off", "medium", "high"],
      };
      else body = {};
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
    });

    render(<MemoryRouter><App /></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: "Model: OpenAI + Pi" }));

    expect(await screen.findByRole("dialog", { name: "Model and runtime selector" })).toBeVisible();
    expect(await screen.findByRole("radio", { name: /GPT Test/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    await user.click(screen.getByRole("tab", { name: /Pi/ }));
    expect(screen.getByText("Pi coding runtime")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: /Claude/ }));
    expect(screen.getByText("Claude runtime")).toBeVisible();
    expect(screen.getByText(/not connected yet/)).toBeVisible();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Model and runtime selector" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Model: GPT Test" })).toHaveFocus();
  });

  it("shows a synthetic proposal for the demo review command", async () => {
    const conversationId = "8afc901e-777c-4f9f-bfac-1727efb1f66d";
    const proposalId = "d07f4af7-95a5-467c-89f5-ded7bc703b62";
    const responses = [
      {
        conversationId,
        piSessionId: null,
        title: "New conversation",
        createdAt: "2026-11-07T14:30:00.000Z",
        updatedAt: "2026-11-07T14:30:00.000Z",
        selectedModel: null,
        thinkingLevel: null,
        approvalMode: "manual",
        status: "idle",
      },
      {
        proposalId,
        conversationId,
        summary: "Preview a synthetic workspace preference change",
        actions: [{
          actionId: "0d642238-2296-48e8-ae92-69e634d88b84",
          operation: "preview",
          targetType: "demo.workspace-preference",
          targetId: null,
          description: "Demonstrate review",
          fields: { density: "compact" },
          effectClass: "synthetic",
        }],
        status: "pending",
        createdAt: "2026-11-07T14:30:00.000Z",
        expiresAt: "2026-11-07T15:00:00.000Z",
        contentDigest: "a".repeat(64),
        synthetic: true,
      },
    ];
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/v1/usage")) {
        return Promise.resolve(new Response(JSON.stringify({ available: false, reason: "Test usage unavailable", checkedAt: "2026-11-07T14:30:00.000Z" }), { status: 200, headers: { "Content-Type": "application/json" } }));
      }
      if (url.endsWith("/api/v1/status")) {
        return Promise.resolve(new Response(JSON.stringify({ available: true, runtime: "fake", modelCount: 1, capabilities: { tools: [], externalAccess: false, mutations: false, scope: "Test runtime" } }), { status: 200, headers: { "Content-Type": "application/json" } }));
      }
      if (url.endsWith("/api/v1/conversations") && !init?.method) {
        return Promise.resolve(new Response(JSON.stringify({ conversations: [] }), { status: 200, headers: { "Content-Type": "application/json" } }));
      }
      return Promise.resolve(new Response(JSON.stringify(responses.shift()), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }));
    }));
    const user = userEvent.setup();
    render(<MemoryRouter><App /></MemoryRouter>);

    await user.type(screen.getByLabelText("Message Simon"), "/demo-review{Enter}");

    expect(await screen.findByText("Synthetic demonstration")).toBeVisible();
    expect(screen.getByRole("button", { name: "Approve demo" })).toBeVisible();
  });

});
