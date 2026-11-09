# Architecture Decisions

## Chosen stack

- Frontend: React, TypeScript, Vite, React Router, Zustand, TanStack Query.
- Backend: Node.js, TypeScript, Fastify.
- Contracts: shared runtime-validated TypeScript schemas.
- Storage: SQLite for Simon metadata; Pi sessions for authoritative transcripts.
- AI runtime: Pi SDK behind a Simon-owned adapter.
- Browser transport: HTTP commands and Server-Sent Events.
- Tests: Vitest, React Testing Library, Playwright, backend injection tests.
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
