# SIMON

## Your TIA Portal. Supercharged.

> Simon is a project-aware engineering copilot that runs alongside TIA Portal, understands existing mixed-language PLC projects, retrieves version-correct Siemens documentation, and proposes and applies reviewed changes through supported engineering interfaces.

**You engineer. SIMON handles the legwork.**

## Current implementation scope

Development currently focuses on the reusable local chat application and Pi assistant runtime. TIA Portal, Siemens Openness, Fanqi, MCP, PLC project access, compilation, and engineering writes are not connected yet.

The current application provides:

- a focused full-window desktop-style chat interface;
- streamed Pi conversations with stop, reconnect, replay, and recovery states;
- persistent conversations, drafts, transcript search, and Pi branch navigation;
- Retry, edit/resend, response copying, and code-block copying;
- model, thinking-level, slash-command, and approval-mode controls;
- one explicitly allowlisted read-only synthetic knowledge tool with grounded sources;
- truthful runtime activity, capability disclosure, and sanitized 5h/7d Codex usage.

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

The chat foundation and expanded Chat UX implementation are complete. Simon includes the full-window React chat, Fastify/SSE backend, SQLite metadata and FTS5 search, persistent Pi sessions and branches, runtime controls, synthetic proposal demonstrations, deterministic fake runtime, and one restricted read-only synthetic knowledge tool. Manual browser qualification remains; see [`docs/MANUAL_QA.md`](docs/MANUAL_QA.md).

## Commands

```bash
npm install
npm run dev       # Fastify on 4310 and Vite on 4311
npm run typecheck
npm test
npm run build
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
./scripts/start-simon.ps1 -SkipBuild -NoBrowser
./scripts/start-simon.ps1 -Port 4320
```

## Privacy and safety

Simon is local-first. Provider credentials remain server-side in Pi's supported configuration. The local API will bind to loopback by default. Never commit credentials, sessions, proprietary project data, Siemens files, or customer source.

Simon is independent and is not affiliated with or endorsed by Siemens.
