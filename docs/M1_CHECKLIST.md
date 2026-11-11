# M1 read-only environment and attachment gate

This checklist is the executable acceptance gate for milestone M1 in `docs/Simon_v0_3.md`.

## Automated

- [x] Shared engineering process, binding, status, inventory, capability, and diagnostic payloads are runtime-validated.
- [x] Existing SQLite databases migrate without losing conversations.
- [x] A conversation can hold one immutable project binding.
- [x] Selecting a different target for a bound conversation is rejected.
- [x] Process selection checks both process ID and Windows process start time.
- [x] An unbound or stale conversation cannot execute a TIA tool.
- [x] TIA lifecycle tools remain host-only and are never registered with Pi.
- [x] Compile, save, import, project mutation, shell, filesystem, browser, and generic MCP tools remain unavailable.
- [x] Disconnect disposes Simon's Openness attachment without invoking project close.
- [x] Synthetic mode does not start the engineering MCP process.
- [x] API and UI tests cover discovery, attachment, inventory, detach, failure, and reconnect-required states.
- [x] `npm run typecheck`, `npm test`, `npm run build`, and `git diff --check` pass.

## Live target-machine qualification

- [x] Start Simon explicitly in `tia-readonly` mode.
- [x] Discover running TIA Portal processes without attaching.
- [x] Show process ID, process start time, discovery time, and open-project availability.
- [x] Explicitly select the intended process from the Simon UI.
- [x] Display the bound project name, read-only policy, observation time, and binding identity.
- [x] Display supported inventory scope and honest coverage limitations.
- [x] Ask Pi which project is open and receive a real tool-backed answer.
- [x] Retrieve the bounded project inventory through Simon's application API.
- [x] Change or invalidate the target and confirm stale reads are blocked.
- [x] Disconnect Simon and confirm TIA Portal and the engineer's project remain open.
- [x] Restart Simon and confirm that explicit reconnection is required.
- [x] Confirm a direct save or other unclassified mutation remains denied.
- [x] Record environment, expected result, observed result, and limitations in `mcp/LIVE_QUALIFICATION.md`.

## Out of scope for M1

- PLC/HMI tag enumeration or total tag counts.
- SCL source extraction and project indexing.
- Cross-reference retrieval.
- Documentation search and approved conventions.
- Any project write, compile, save, download, online operation, or recovery workflow.
