# Architectural Decisions

This log records durable project decisions. Concise summaries also appear in `references/architecture-decisions.md`.

## TypeScript full stack — 2026-11-07

**Context:** The first implementation slice needs a local browser application, backend orchestration, shared contracts, and Pi integration.

**Decision:** Use React/TypeScript for the frontend and Node.js/TypeScript with Fastify for the backend.

**Alternatives considered:** A Python backend matching the source handoff; a desktop framework immediately; separate languages for frontend and backend.

**Consequences:** Pi can be integrated through its direct SDK, contracts can be shared, and packaging remains open. The backend initially shares a process with Pi unless a later isolation decision selects RPC.

## Pi SDK behind a Simon adapter — 2026-11-07

**Context:** Simon needs Pi sessions and events without coupling browser contracts to Pi internals.

**Decision:** Introduce an application-owned `PiRuntime` boundary and use the Pi SDK behind it for the initial local implementation.

**Alternatives considered:** Direct Pi imports throughout the backend; Pi RPC subprocess from the beginning.

**Consequences:** Event and state mapping require explicit code, but RPC can replace the SDK later without redesigning the UI.

## HTTP commands and SSE events — 2026-11-07

**Context:** The UI needs normal request handling plus ordered streaming and reconnect support.

**Decision:** Use HTTP for commands and Server-Sent Events for backend-to-browser run events.

**Alternatives considered:** WebSockets; direct terminal/RPC stream exposure.

**Consequences:** The API remains simple and browser-friendly. Full-duplex behavior uses separate HTTP requests.

## Restricted initial assistant capability — 2026-11-07

**Context:** The current scope is the chat UI and assistant handoff, not TIA or an agentic coding environment.

**Decision:** Do not expose shell, filesystem writes, MCP, TIA, Fanqi, or arbitrary external mutation tools to the in-app assistant.

**Alternatives considered:** Reusing the developer's full Pi configuration and tools.

**Consequences:** The first assistant is conversational. Future tools must enter through reviewed Simon contracts.

## Synthetic proposal workflow — 2026-11-07

**Context:** Manual/Auto and proposal review are accepted product behaviors, but no domain mutation backend exists yet.

**Decision:** Implement and test the review state machine with explicitly synthetic actions.

**Alternatives considered:** Defer review UI entirely; connect a temporary real mutation tool.

**Consequences:** UX and contracts can mature safely. The UI must never imply that synthetic approval changed an external system.

## npm workspaces — 2026-11-07

**Context:** pnpm was recommended in the plan but is not installed in the environment.

**Decision:** Use npm workspaces initially.

**Alternatives considered:** Install pnpm globally; use independent package directories.

**Consequences:** No extra package-manager prerequisite is needed. Revisit only if npm becomes a material constraint.

## Central runtime capability policy — 2026-11-07

**Context:** Pi session setup, event handling, status disclosure, and tests must report the same security boundary.

**Decision:** Define the allowed tool names, mutation flag, external-access flag, and user-facing scope in one server policy module.

**Alternatives considered:** Duplicate allowlists in runtime setup and status responses; rely only on documentation.

**Consequences:** Any future tool requires an explicit policy and regression-test change. Built-in shell, browser, arbitrary filesystem, and generic MCP tools remain excluded. The later M1 amendment permits only explicitly classified read-only TIA tools through Simon's application-owned adapter.

## Explicit conversation-scoped TIA binding — 2026-11-09

**Context:** M1 requires real read-only TIA results without allowing the model or browser to select a process, silently inherit a target, or reuse stale context after a restart or project change.

**Decision:** Keep TIA lifecycle operations host-controlled. The browser may request discovery and explicit attachment through Simon HTTP endpoints, but only the backend invokes MCP lifecycle tools. Bind each engineering conversation to an opaque project binding containing a stable Windows process-start identity, project identity hash, and connection epoch. Pi tools verify that binding before every read. Ordinary startup and restart never auto-attach.

**Alternatives considered:** Automatically choose the first process with an open project; expose lifecycle tools to Pi; use process ID alone; keep one mutable project target shared by all conversations.

**Consequences:** Selecting another target requires a new conversation or explicit safe reconciliation. Restarts require reconnection. Stale bindings fail closed. Simon can detach without closing TIA Portal, while compile, save, import, mutations, shell, filesystem, and online PLC operations remain blocked.

## Binding-scoped read-only project snapshots — 2026-11-11

**Context:** M2 needs searchable block source, interfaces, tags, references, and hardware evidence. Several Siemens read operations produce local exports, and repeatedly exporting during Pi turns would be slow, difficult to bound, and hard to cite consistently.

**Decision:** Treat worker-controlled exports as artifact-producing reads, not project mutations. Only the Simon backend may create or refresh an immutable project snapshot. Each snapshot is tied to one project binding and connection epoch, stores bounded metadata in SQLite, stores larger normalized payloads in opaque application artifacts under ignored runtime storage, and exposes exact/FTS5 retrieval through Simon-owned contracts. Pi may query completed snapshots but cannot choose export paths or invoke internal export operations.

**Alternatives considered:** Export directly during every Pi tool call; expose worker export paths to Pi; index raw MCP responses in the browser; use a cloud/vector index immediately; treat all filesystem output as forbidden.

**Consequences:** Snapshot creation is explicit, cancellable, partial-aware, and freshness-sensitive. Detach, restart, target change, or epoch mismatch makes a snapshot stale for live claims. Exact lookup precedes lexical search, embeddings remain deferred, raw project/export paths stay private, and compile, import, save, source generation, project mutation, and online PLC operations remain blocked.
