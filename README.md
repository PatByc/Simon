# SIMON

## Your TIA Portal. Supercharged.

> Simon is a project-aware engineering copilot that runs alongside TIA Portal, understands existing mixed-language PLC projects, retrieves version-aware Siemens documentation, and captures engineer-approved local conventions without granting write authority.

**You engineer. SIMON handles the legwork.**

## Current implementation scope

Simon now includes the reusable local chat application, Pi assistant runtime, and an explicitly enabled read-only TIA Portal V20 connection through Simon's policy-controlled MCP boundary. Compilation, import, save, project mutation, online PLC operations, shell access, and arbitrary filesystem access remain disabled.

The current application provides:

- a focused full-window desktop-style chat interface;
- streamed Pi conversations with stop, reconnect, replay, and recovery states;
- persistent conversations, drafts, transcript search, and Pi branch navigation;
- Retry, edit/resend, response copying, and code-block copying;
- model, thinking-level, slash-command, and approval-mode controls;
- a synthetic fixture mode for ordinary development;
- an optional `tia-readonly` mode with explicit process selection, conversation-scoped project binding, bounded inventory, diagnostics, 20 direct TIA reads, and three application-owned snapshot retrieval tools;
- bounded immutable engineering snapshots with persisted freshness, exact and lexical retrieval, references, citations, and explicit partial coverage;
- local-only installed V20 help ingestion with deterministic normalization, applicability-first exact/FTS5 retrieval, stable citations, and a rights-blocked online source record;
- host-controlled convention inference, approval, immutable revision history, retirement, and approved-only Pi retrieval;
- 27 explicitly classified read tools in `tia-readonly` mode, with ingestion, approval, lifecycle, mutation, shell, and arbitrary filesystem/network operations withheld from Pi;
- truthful runtime activity, capability and coverage disclosure, and sanitized 5h/7d Codex usage.

See [`docs/PLAN.md`](docs/PLAN.md) for the active implementation plan and [`AGENTS.md`](AGENTS.md) for project workflow and conventions.

## Workspace

```text
app/web/              React browser application
app/server/           Local backend and future Pi host
packages/contracts/   Shared API and event contracts
references/           Product and engineering guidance
docs/                 Handoffs, plan, roadmap, and decisions
```

## Development status

The chat foundation, M1 read-only attachment, M2 source extraction/retrieval, localhost product acceptance, and M3 documentation/approved-convention implementation are complete. Simon has been live-qualified against the user-opened TIA V20 project and the installed STEP 7 V20 Update 7 help. Exact and lexical documentation retrieval, applicability disclosure, rights blocking, grounded Pi answers, convention rejection/approval/revision/retirement, and restart persistence are recorded in [`docs/M3_LIVE_QUALIFICATION.md`](docs/M3_LIVE_QUALIFICATION.md). Broader manual release regression remains in [`docs/MANUAL_QA.md`](docs/MANUAL_QA.md); Electron packaging remains deferred.

## Commands

```bash
npm install
npm run dev       # Fastify on 4310 and Vite on 4311
npm run typecheck
npm test
npm run build
npm run doctor    # Redacted runtime/engineering diagnostics; set SIMON_ENGINEERING_MODE as needed
npm start         # Build and serve the production app on 127.0.0.1:4310
```

Set `SIMON_RUNTIME=fake` for deterministic UI development without calling a model. The default is the restricted real Pi runtime.

### Windows launcher

After `npm install`, start the production app with:

```powershell
./scripts/start-simon.ps1
```

Or double-click/run:

```text
scripts\start-simon.cmd
```

Useful options:

```powershell
./scripts/start-simon.ps1 -Runtime fake
./scripts/start-simon.ps1 -EngineeringMode tia-readonly
./scripts/start-simon.ps1 -SkipBuild -NoBrowser
./scripts/start-simon.ps1 -Port 4320
```

## Privacy and safety

Simon is local-first. Provider credentials remain server-side in Pi's supported configuration. The local API binds to loopback by default. TIA attachment is explicit and read-only; disconnecting Simon does not close TIA Portal. Never commit credentials, sessions, proprietary project data, Siemens files, or customer source.

Simon is independent and is not affiliated with or endorsed by Siemens.
