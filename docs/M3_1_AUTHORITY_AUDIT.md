# M3.1 Browser, HTTP, and Pi Authority Audit

**Baseline:** `e88dd31`
**Date:** 2026-11-11
**Scope:** Production Fastify routes, browser API reachability, Pi tool allowlists/providers, and explicit host-only denials.

## Classification rules

- **Read:** Returns bounded application evidence without changing external or authority state.
- **Local application command:** Changes Simon-owned conversation/demo/UI state only.
- **Explicit user engineering lifecycle:** Browser-requested, backend-executed TIA attachment/detach or snapshot capture already accepted by M1/M2; never exposed to Pi.
- **Host administration:** Changes convention authority and must not be ordinary browser/Pi HTTP.
- **Prohibited:** Compile, save, import, export-path selection, source generation, project/PLC mutation, arbitrary URL/file/network/shell/filesystem, or model-controlled lifecycle.

## Production HTTP inventory

### Read-only evidence

- Assistant status and usage status.
- Convention status and immutable history.
- Documentation status and bounded documentation search.
- Engineering status, process discovery, capabilities, diagnostics, inventory, snapshot status, bounded search, and references.
- Conversation list/search/detail/messages/branches/runtime options and run-event SSE.
- Synthetic knowledge search.

`POST` documentation, engineering, and synthetic search routes are read commands despite their HTTP verb; request bodies are bounded and runtime validated.

### Local application commands

- Conversation create/update/delete, branch selection, runtime preference updates, run/edit/regenerate/abort.
- Explicitly synthetic demo-proposal creation and decisions.

These operate on Simon-owned local state and do not grant engineering or convention authority.

### Explicit user engineering lifecycle

- Process discovery followed by conversation-scoped read-only attachment.
- Safe engineering detach.
- Explicit engineering snapshot creation/refresh.

These remain browser workflows owned and guarded by the backend. Pi has no corresponding lifecycle tools. They do not compile, save, import, generate source, mutate the project, or access a PLC online.

### Host-administration violations

The baseline registers four convention-authority commands on ordinary Fastify HTTP:

1. `POST /api/v1/conventions/proposals`
2. `POST /api/v1/conventions/:conventionId/decision`
3. `POST /api/v1/conventions/:conventionId/revisions`
4. `POST /api/v1/conventions/:conventionId/retirement`

These routes are not used by the product UI and are not Pi tools, but they are browser-reachable on the same origin. Hiding them is not a host-only boundary. M3.1 must remove them from production HTTP before release acceptance.

## Pi tool inventory

### Synthetic mode: five tools

- One bundled synthetic-knowledge search tool.
- Two documentation status/search tools.
- Two approved-convention count/search tools.

### TIA read-only mode: 27 tools

- Twenty direct classified TIA reads.
- Three engineering-snapshot retrieval tools.
- Two documentation status/search tools.
- Two approved-convention count/search tools.

All model-visible tools are read-classified. Pi has no attachment, detach, snapshot refresh, export/artifact, documentation ingestion/refresh, arbitrary URL/file, convention decision, shell/filesystem, compile/save/import, project mutation, source generation, or online PLC tool.

## Findings

| ID | Severity | Finding | Required resolution |
| --- | --- | --- | --- |
| AA-001 | high | Four convention lifecycle operations are reachable through ordinary browser HTTP, contradicting the host-only authority boundary. | Remove them from production Fastify registration; preserve lifecycle through a separate explicit host interface and add route-denial regressions. |
| AA-002 | low | The explicit host-only tool-name denylist includes convention approve/reject/revise/retire but not future-looking propose/activate names. No such Pi tools currently exist. | Add propose/activate names to the defensive denylist and policy tests. |
| AA-003 | low | Unknown convention-history identifiers currently return an empty history object instead of an explicit not-found response. | Define a read-only history contract and return bounded 404 behavior for unknown IDs. |

## Prohibited-capability result

No production HTTP route or Pi tool implements TIA compile, save, import, source generation, project mutation, online PLC operation, arbitrary shell/filesystem execution, arbitrary URL/file documentation ingestion, or Siemens online-content crawling.

## M3.1 disposition

AA-001 is a release blocker and is addressed by Steps 6–11. AA-002 is addressed with the route/tool boundary regressions. AA-003 is addressed by the read-only contract and UI work. No M4 authority is needed to resolve any finding.
