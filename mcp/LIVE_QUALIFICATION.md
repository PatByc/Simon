# TIA V20 live qualification

Date: 2026-11-09

## Environment

- Simon-incorporated worker: `mcp/worker/tia/v20/server`
- Target: installed TIA Portal V20 PublicAPI
- Worker executable SHA-256 after the M1 process-identity build: `12D97360B6B173B354D030536901A109B3C9B15F06376DEA8618937018CE3340`
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

## M1 application-level qualification — 2026-11-09

The production Simon application was started with `SIMON_ENGINEERING_MODE=tia-readonly` and exercised through its HTTP and Pi paths rather than by calling the MCP façade directly.

Verified results:

- Process discovery returned the running TIA V20 process without attaching.
- The discovery contract included PID, Windows process start time, discovery acquisition time, and open-project availability.
- Attachment required an explicit PID plus matching process start time.
- Simon created a conversation-scoped binding with an opaque binding ID, connection epoch, project name, redacted path hash, and observed timestamp.
- The application inventory endpoint returned the real bounded project tree with `partial=true` and explicit M1 coverage limitations.
- A Pi turn invoked the guarded TIA state tool and correctly reported the bound project and connected state.
- Detaching Simon left the same TIA process visible with its project still open.
- After application restart, the persisted conversation retained its target metadata but the runtime reported `disconnected` and required explicit reconnection.
- The direct MCP qualification still rejected an unclassified `SaveProject` call.

The project name, local path, project contents, and machine-specific process identifiers are intentionally omitted from this record.

Limitations:

- Browser interaction was covered by deterministic component tests; the target-browser manual checklist remains pending.
- Only M1 inventory/state operations are claimed here. Tags, source retrieval, references, and deeper hardware coverage remain M2 work.
