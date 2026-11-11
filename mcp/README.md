# Simon Engineering MCP

Simon Engineering MCP is the policy-controlled engineering boundary between Simon's application backend and version-specific engineering connectors. It is local, single-user, denied by default, and currently targets read-only TIA Portal V20 project inspection.

## Responsibility boundary

```text
Simon UI
   │ HTTP/SSE
Simon application backend
   │ Pi custom-tool adapter / trusted approval authority
   │ MCP stdio
Simon Engineering MCP (this package)
   │ stable Simon contracts and allowlist
TIA V20 connector
   │ MCP stdio
Simon-incorporated .NET V20 worker
   │ Siemens Openness V20
TIA Portal / selected project
```

The browser never calls MCP. Pi never connects to the raw TIA V20 worker. The worker's complete catalog is not proxied. Simon registers only explicitly classified tools.

This package does not own conversation workflows, Manual/Auto decisions, proposal persistence, human approval, or authorization for future project writes. Those remain application-backend responsibilities.

## Layout

- `src/server/` — MCP protocol host, lifecycle, request context, and stdio transport.
- `src/registry/` — authoritative Simon tool registry and mapping validation.
- `src/contracts/` — stable result, error, pagination, and TIA domain contracts.
- `src/policy/` — effects, exposure, modes, limits, and project-binding checks.
- `src/tools/` — Simon MCP tools grouped by engineering capability.
- `src/connectors/` — generic connector interfaces, reusable process support, and versioned adapters.
- `src/connectors/tia/v20/` — TIA Portal V20 connector and exact upstream mapping. The architecture does not use a vendor-named `fanqi/` directory.
- `worker/tia/v20/` — incorporated, attributed .NET Framework/Openness worker source and offline tests.
- `src/artifacts/` — controlled opaque artifact storage.
- `src/observability/` — correlation, events, and redaction.
- `src/testing/` — deterministic fake connector support.
- `test/` — production-independent unit and integration tests.

The layout permits later `tia/v21`, `tia/simulated`, `siemens-docs`, or `plcsim` connectors without changing the server, registry, or policy layers. Those connectors are extension seams, not currently implemented capabilities.

## Mapping chain

Every callable operation has three distinct identities:

```text
GetProjectTree                  upstream TIA V20 MCP tool
    ↓
tia.project.getTree            connector capability
    ↓
simon_tia_get_project_tree     Simon MCP tool
```

`TOOL_MAPPING.md` is generated from `src/connectors/tia/v20/tool-map.ts`. Each entry records effect, exposure, connection requirements, project-binding requirements, and artifact behavior.

An upstream tool absent from the mapping is denied. A mapped tool absent from the upstream server is unavailable. A tool is model-visible only when both the registry and active operating mode allow it.

## Operating modes

- `synthetic` — no TIA connector.
- `tia-readonly` — only qualified read operations.
- `tia-proposal` — reserved for future preview/proposal preparation.
- `tia-write` — reserved for a separately designed approved execution broker.

Mutation, compile, save, project open/close, document import, and source generation are blocked during the read-only phase.

## TIA V20 configuration

```text
SIMON_ENGINEERING_CONNECTOR=tia-v20
SIMON_TIA_PROCESS_ID=1234              # optional host-selected process
SIMON_TIA_V20_TOOL_TIMEOUT_MS=30000
SIMON_TIA_V20_ARTIFACT_ROOT=./data/mcp-artifacts
```

The worker source is incorporated under `worker/tia/v20/` and the executable path is resolved internally. Build it with `npm run worker:build --workspace @simon/mcp`. Arguments are fixed in code. The model and browser cannot choose a command, executable, environment, or working directory.

## Artifacts and provenance

Artifact-producing reads use a controlled Simon directory. Public results contain opaque artifact IDs and SHA-256 digests, not local paths. Limits apply before storage. Engineering exports, customer projects, Siemens binaries, credentials, and safety passwords must never be committed.

Connector identity is exposed only as provenance. Simon contracts and tool names remain independent from the current upstream implementation.

## Openness constraints

Implementation decisions follow `docs/openess/REFERENCE.md`:

- Use installed, version-matched V20 public assemblies.
- Do not expose arbitrary Openness invocation or live Siemens objects.
- Reacquire objects after project/process lifecycle changes.
- Treat project connection and Windows group membership as prerequisites, not authorization.
- Treat XML, SIMATIC SD documents, and generated source as distinct representations.
- Keep compile and save separate from mutation transactions.
- Report partial, stale, unsupported, or failed observations truthfully.

## Commands

```bash
npm run typecheck --workspace @simon/mcp
npm run worker:build --workspace @simon/mcp
npm run test --workspace @simon/mcp
npm run build --workspace @simon/mcp
npm run docs --workspace @simon/mcp
```

## Expansion checklist

A new connector or engineering capability is not enabled until all applicable items pass:

1. Define Simon-owned input, output, error, provenance, and pagination contracts.
2. Assign an effect and exposure classification.
3. Add a stable connector capability independent of upstream naming.
4. Add an explicit upstream-to-connector-to-Simon mapping.
5. Define connection, project-binding, timeout, payload, and artifact limits.
6. Keep commands, paths, credentials, and environment values outside model control.
7. Implement deterministic fake responses and failure cases.
8. Add direct registry and tool-call tests; listing a tool name is insufficient.
9. Verify that unclassified and unsupported operations remain denied.
10. Update and regenerate `TOOL_MAPPING.md`.
11. Record source, dependency, executable, and connector provenance.
12. Qualify on the exact target environment using a disposable or backed-up project.
13. Record live evidence, limitations, and freshness semantics.
14. Explicitly enable the capability in application runtime policy.
15. Re-audit whenever source, dependencies, executable, permissions, or behavior changes.

## Current qualification status

The TIA V20 worker is incorporated into Simon and builds from locked dependencies. Offline TypeScript tests and .NET XML-analysis tests pass.

A live read-only qualification against TIA Portal V20 verified:

- host-only process discovery, attachment, and disconnect;
- state and open-project reads;
- project-tree retrieval from the engineer-opened local project;
- 20 model-visible direct TIA read tools and five host-only lifecycle/artifact tools;
- absence of raw compile, import, save, and mutation tools from the Simon MCP catalog;
- rejection of a direct unclassified `SaveProject` call.

All mapped operations are marked `live-tested` in `TOOL_MAPPING.md` because each was invoked against the target TIA V20 environment. A live-tested operation may still have partial coverage, timeout, path-resolution, format, or Siemens prerequisite limitations; those are recorded independently in `M2_LIVE_QUALIFICATION.md`. Application-owned snapshot status, search, and reference tools are implemented in the Simon server rather than this raw MCP catalog.
