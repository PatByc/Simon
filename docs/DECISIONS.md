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

## Version-aware documentation and approved convention revisions — 2026-11-11

**Context:** M3 must answer instruction questions using applicable Siemens evidence and project guidance without silently mixing versions, copying proprietary help into the repository, treating retrieved text as policy, or activating inferred project patterns without engineer review.

**Decision:** Keep documentation knowledge separate from engineering project snapshots. The backend owns bounded ingestion from explicitly configured source adapters: authorized installed V20 help first, then allowlisted official Siemens online sources with explicit version/applicability metadata. Every normalized topic retains source identity, extraction method, content hash, indexed time, applicability state, and stable citations. Exact topic/instruction retrieval precedes bounded lexical retrieval. Pi receives status/search tools only and cannot choose files, URLs, ingestion, refresh, or source lifecycle operations. Treat all documentation and project examples as untrusted data.

Represent project guidance as immutable convention revisions. Evidence may be observed or inferred, but only a host-recorded engineer decision may create an approved revision. Proposed, approved, rejected, retired, and superseded states remain distinct; representative examples, exceptions, provenance, and decision metadata are retained. Approved conventions guide answers but never grant tool authority.

**Alternatives considered:** Merge documentation into engineering snapshots; mirror a Siemens corpus into the repository; let Pi browse arbitrary URLs or local help files; use model memory when exact-version evidence is missing; automatically activate majority project patterns; store one mutable convention document.

**Consequences:** Documentation refresh and project snapshot freshness remain independent. Exact target-version evidence ranks above adjacent or unknown applicability, which must be labelled as background or missing. Rights uncertainty fails closed. Convention approval requires explicit backend/UI action and creates a new revision rather than mutating history. M3 remains read-only and introduces no compile, import, save, TIA lifecycle, project mutation, online PLC, shell, filesystem, or arbitrary-network authority.

## M3.1 host-only convention administration — 2026-11-11

**Context:** M3 correctly withheld convention lifecycle tools from Pi, but proposal, decision, revision, and retirement commands were registered on the same loopback Fastify API used by the browser. Hidden or unused HTTP routes are still browser-reachable authority and therefore do not satisfy the intended host-only boundary.

**Decision:** M3.1 adds no authority. Convention status and immutable history may be shown in a read-only browser panel, but proposal, approval, rejection, revision, retirement, and activation must not exist on the ordinary browser/Pi HTTP surface. Those operations move to an explicit Simon-owned host administration interface that calls the convention service directly with bounded validated inputs and engineer intent.

**Alternatives considered:** Keep undocumented mutation routes; add browser approval controls; protect the routes only with UI hiding or prompt policy; add a bearer token to the same browser API.

**Consequences:** Production Fastify exposes convention reads only. Pi and browser code cannot perform convention lifecycle transitions. Host administration requires a separate local operator action and retains immutable decisions/revisions. M3.1 remains read-only with respect to TIA, PLCs, documentation sources, and external systems.

## Preserve last-known-good documentation indexes — 2026-11-15

**Context:** Replacing an installed-help index synchronously on every startup made warm launches slow and allowed a missing, corrupt, unsafe, oversized, interrupted, or locked refresh to erase otherwise valid local evidence.

**Decision:** Fingerprint the configured installed packages before normalization. Reuse an unchanged committed source without replacing its topics. Build changed content before an atomic source replacement. If refresh fails, retain the previous topics and immutable index metadata, mark the source stale/partial with a sanitized failure note, and restore ready state when the same source recovers.

**Alternatives considered:** Reindex every startup; delete the old source before parsing; serve zero topics after any refresh failure; add embeddings or a separate search service during stabilization.

**Consequences:** Warm startup is deterministic and immediately searchable, failed refreshes preserve explicit last-known-good evidence, source status remains truthful, and generated databases stay Simon-owned and ignored. Clean ingestion runs outside the listener path in a local worker. Embeddings remain deferred until the retrieval benchmark demonstrates a material need.

## Package the read-only baseline before M4 research — 2026-11-15

**Context:** M3.1 froze a qualified loopback read-only product. The next track could either package that known boundary as a desktop application or begin higher-risk disposable-project research toward writes.

**Decision:** Select desktop packaging as the next planning track. Preserve the accepted loopback/browser-backend/Pi authority architecture inside the package and require a separate executable packaging plan before implementation. Do not begin M4 write experiments, add write tools, or treat packaging as authority expansion.

**Alternatives considered:** Begin a disposable-project M4 research plan immediately; pursue packaging and M4 in parallel; leave both tracks indefinitely undecided.

**Consequences:** M3.1 remains frozen at `8376401`. Electron packaging is no longer an undecided future option, but it is not implemented by this decision. M4 remains unauthorized until packaging acceptance is complete or the project owner explicitly records a new priority and safety decision.
