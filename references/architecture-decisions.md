# Architecture Decisions

## Chosen stack

- Frontend: React, TypeScript, Vite, React Router, Zustand, TanStack Query.
- Backend: Node.js, TypeScript, Fastify.
- Contracts: shared runtime-validated TypeScript schemas.
- Storage: SQLite for Simon metadata; Pi sessions for authoritative transcripts.
- AI runtime: Pi SDK behind a Simon-owned adapter.
- Browser transport: HTTP commands and Server-Sent Events.
- Tests: Vitest, React Testing Library, backend injection tests, and manual/CDP production qualification; Playwright remains deferred.
- Package management: npm workspaces for the initial repository.

## ADR-001: Use a TypeScript full stack

**Decision:** Use React and Fastify in one TypeScript workspace.
**Reason:** Pi provides a direct TypeScript SDK, shared types reduce contract drift, and the project is a local single-user application.
**Trade-offs:** The Pi process initially shares the backend process; stronger isolation may later require RPC.
**Date:** 2026-11-07

## ADR-002: Put Pi behind an application adapter

**Decision:** Browser and core application code depend on a `PiRuntime` interface, not directly on Pi SDK internals.
**Reason:** Stabilizes Simon contracts and permits a future SDK-to-RPC migration.
**Trade-offs:** Requires explicit event and state mapping.
**Date:** 2026-11-07

## ADR-003: Use HTTP plus SSE

**Decision:** Use request/response HTTP for commands and SSE for ordered runtime events.
**Reason:** Matches the handoff interaction model and supports straightforward reconnect/replay behavior.
**Trade-offs:** Client-to-server interaction remains separate HTTP requests; full duplex WebSockets are deferred.
**Date:** 2026-11-07

## ADR-004: Restrict the first Pi profile

**Decision:** Do not expose shell, write, edit, MCP, TIA, or arbitrary filesystem tools in the first slice.
**Reason:** The current goal is the chat/runtime foundation, not an agentic engineering backend.
**Trade-offs:** The assistant initially provides conversation rather than code or project manipulation.
**Date:** 2026-11-07

## ADR-005: Demonstrate review with synthetic proposals

**Decision:** Build the proposal/review state machine against explicitly labeled synthetic actions before domain tools exist.
**Reason:** Proves Manual/Auto UX and contracts without implying external authority.
**Trade-offs:** The first proposal workflow is demonstrative rather than productive.
**Date:** 2026-11-07

## ADR-006: Use npm workspaces initially

**Decision:** Use the available npm workspace tooling instead of adding another package manager prerequisite.
**Reason:** Node and npm are already installed and verified on the target machine.
**Trade-offs:** The plan's original pnpm recommendation is deferred unless npm becomes a constraint.
**Date:** 2026-11-07

## ADR-007: Use explicit conversation-scoped TIA bindings

**Decision:** Keep process discovery, attachment, and detach host-controlled; bind each engineering conversation to a project identity and connection epoch verified before every Pi tool call.
**Reason:** Prevent silent process selection, PID reuse, cross-conversation target leakage, and stale reads after project changes or application restarts.
**Trade-offs:** TIA mode requires an explicit UI connection step, restarts require reconnection, and switching projects requires a new conversation or separate reconciliation flow.
**Date:** 2026-11-09

## ADR-008: Use binding-scoped read-only project snapshots

**Decision:** Let only the Simon backend create bounded immutable snapshots from worker-controlled read exports; persist metadata in SQLite, larger normalized payloads in opaque ignored artifacts, and expose exact/FTS5 retrieval through Simon contracts.
**Reason:** Source retrieval must be fast, citable, freshness-aware, and unable to leak export paths or let Pi orchestrate filesystem-producing worker calls.
**Trade-offs:** Snapshot refresh is explicit and potentially partial; detach, restart, or binding changes stale prior snapshots for live claims. Embeddings are deferred.
**Date:** 2026-11-11

## ADR-009: Separate version-aware documentation from approved convention revisions

**Decision:** Ingest documentation only through backend-owned configured adapters, prefer authorized installed V20 help before allowlisted official online sources, retain explicit applicability/provenance, and use exact-before-FTS5 retrieval. Keep documentation storage separate from engineering snapshots. Treat project patterns as observed/inferred drafts until a host-recorded engineer decision creates an immutable approved convention revision.
**Reason:** Instruction claims need source/version evidence, while project conventions need human authority; neither retrieved text nor majority patterns may alter policy or silently become rules.
**Trade-offs:** Rights or applicability uncertainty fails closed, adjacent-version guidance is background only, refresh workflows are host-controlled, and convention history is append-only rather than a mutable document. Pi receives retrieval tools but no ingestion, URL/file selection, refresh, or approval authority.
**Date:** 2026-11-11

## ADR-010: Keep convention administration off browser HTTP

**Decision:** M3.1 adds no authority. Expose convention status and immutable history as read-only browser evidence, but move proposal, approval, rejection, revision, retirement, and activation off the ordinary browser/Pi HTTP surface into an explicit Simon-owned host administration interface.
**Reason:** A hidden or unused loopback HTTP route is still browser-reachable authority and does not satisfy the intended host-only lifecycle boundary.
**Trade-offs:** Engineers inspect convention evidence in the product but perform lifecycle transitions through a separate bounded local operator action. The application gains a stricter authority boundary at the cost of not offering browser approval controls.
**Date:** 2026-11-11

## ADR-011: Preserve last-known-good documentation indexes

**Decision:** Fingerprint configured installed-help packages, reuse unchanged committed indexes, replace changed content atomically, and retain prior searchable topics as stale/partial when refresh fails.
**Reason:** Startup and refresh failures must not erase valid local engineering evidence, and unchanged warm startup should not pay full normalization/replacement cost.
**Trade-offs:** The UI may intentionally serve older evidence with an explicit stale label while a source is unhealthy. Clean indexing remains asynchronous, and embeddings stay deferred behind the measured retrieval gate.
**Date:** 2026-11-15

## ADR-012: Package the read-only baseline before M4 research

**Decision:** Make desktop packaging the next planning track while preserving the accepted loopback/browser-backend/Pi authority boundary; do not begin M4 write research.
**Reason:** Packaging productizes the already-qualified read-only system without introducing the substantially higher safety and validation risk of engineering writes.
**Trade-offs:** Write research is delayed, and packaging still requires its own executable plan and acceptance gate. The decision selects sequence only; it adds no tool or engineering authority.
**Date:** 2026-11-15
