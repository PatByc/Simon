# TIA V20 live qualification

Date: 2026-11-09

## Environment

- Simon-incorporated worker: `mcp/worker/tia/v20/server`
- Target: installed TIA Portal V20 PublicAPI
- Worker executable SHA-256 after final production build: `157F2BD20EE42C6AE67271FC719A67558F864AB9ACE307D2754A24B09E375783`
- Transport: local stdio MCP
- Project: user-opened local project visible to the `aiagent` Windows/Openness identity; project name and path intentionally not recorded

## Verified live chain

```text
qualification client
→ Simon Engineering MCP server
→ TIA V20 connector
→ incorporated .NET worker
→ Siemens Openness
→ open local TIA project
```

Verified results:

- MCP initialization and catalog listing succeeded.
- Three host-only lifecycle tools were exposed to the trusted client.
- Eighteen read-only engineering tools were exposed as model-eligible tools.
- Host-only TIA process discovery succeeded.
- Host-selected Openness attachment succeeded.
- TIA state retrieval succeeded.
- Open-project retrieval succeeded.
- Project-tree retrieval succeeded.
- Host-controlled disconnect succeeded.
- Raw `SaveProject` was absent from the façade catalog and a direct call was rejected.

Only `GetPortalProcesses`, `Connect`, `Disconnect`, `GetState`, `GetProject`, and `GetProjectTree` were invoked live. Remaining read tools are fake-tested and catalog-qualified, not operation-qualified.

## Boundaries verified

- The browser did not call MCP.
- Pi was not given host-only lifecycle tools.
- Raw upstream mutation tools were not present in the Simon catalog.
- No compile, import, save, project close, source generation, or PLC online operation was invoked.
- Workflow orchestration and approval authority remain outside the connector and worker.
