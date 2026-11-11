# Simon Implementation Plan and Milestone History

**Status:** Chat foundation, M1 read-only attachment, and M2 source extraction/retrieval are complete; manual localhost product acceptance is active
**Current scope:** Chat/Pi runtime plus explicit, conversation-bound, read-only TIA Portal V20 inspection and application-owned snapshot retrieval
**Explicitly excluded:** Engineering mutation, compile, import, save, project lifecycle mutation, source generation, online PLC operations, arbitrary shell/filesystem access, and model-controlled TIA lifecycle or export operations

The early sections below preserve the original chat-foundation plan and its historical exclusions. Sections 15 and 16 describe the subsequently accepted M1 and M2 application boundary.

## 1. Goal

Build the reusable Simon chat application described by `AI_ASSISTANT_MCP_HANDOFF.md`, replacing its OpenAI-specific planner with Pi while preserving the useful product behavior:

- a global assistant drawer available from every application page;
- overlay and docked/pinned layouts;
- streamed assistant responses and truthful activity states;
- persistent local conversations;
- slash-command discovery;
- Manual approval and Auto execute controls with clear scope;
- proposal/review components that can initially run against synthetic actions;
- a backend-owned Pi session and event adapter;
- clean contracts that later allow Simon engineering tools to be added without redesigning the UI.

The original first release was a general Simon assistant shell and was required not to imply unavailable TIA, MCP, project-read, or project-write capabilities. Later milestone amendments add only the explicitly qualified read-only capabilities described below.

### Implementation checkpoint — 2026-11-07

Completed:

- TypeScript workspace and shared validated contracts.
- React application shell with global overlay/pinned assistant drawer.
- Fastify HTTP/SSE backend with reconnect, replay, heartbeat, and stable events.
- Restricted Pi SDK integration with no tools, MCP, extensions, or project resources.
- SQLite conversation metadata and persistent Pi sessions.
- Conversation history, rename, delete, delete-all, restart restoration, and interruption handling.
- Slash commands, command palette, model/thinking controls, and truthful activity traces.
- Manual/Auto synthetic proposal state machine with immutable digests.
- Safe Markdown, security headers, production static hosting, error recovery, and bundle splitting.
- Unit, contract, API, and component tests.

Pending qualification:

- Execute `docs/MANUAL_QA.md` on the target browser and Windows setup.
- Decide whether a packaged desktop/launcher experience is needed beyond `npm start`.

Explicitly deferred by user decision: Playwright and automated browser E2E testing.

### Expanded Chat UX checkpoint — 2026-11-08

Completed after the initial slice:

- Chat-only full-window application replacing the temporary website shell.
- Premium industrial/refined visual system with the `frontend-design` skill as the project standard.
- Todai-derived composer, icon controls, approval-mode popover, tooltips, and global scrollbar treatment.
- Responsive collapsible conversation sidebar with rename, delete, active state, and local drafts.
- Response copying, fenced-code copying, Retry, edit/resend, and persisted Pi branch navigation.
- Respectful scroll anchoring and a Latest control.
- Transcript loading skeletons and interrupted-run recovery presentation.
- SQLite FTS5 search across titles, user prompts, and assistant responses while Pi JSONL remains authoritative.
- One restricted read-only synthetic knowledge tool with grounded source cards and truthful lifecycle events.
- Visible capability policy and a centralized runtime tool allowlist.
- Live sanitized OpenAI Codex 5h/7d usage display.
- SSE reconnect status, replay, deduplication, retry exhaustion, and recovery presentation.
- Real Pi qualification for streaming, branching, edit/resend, tool usage, abort, model selection, thinking selection, and restart persistence.

Still pending:

- Complete the browser/manual accessibility and responsive checklist in `docs/MANUAL_QA.md`.
- Resolve any findings from that qualification.
- Package the stable localhost application as Electron only after acceptance.

## 2. Product boundary

### Included

1. Local web application shell.
2. Global chat drawer and full-page compatibility route.
3. Pi-backed conversations using the installed/configured Pi runtime.
4. Token streaming, cancellation, retry/error presentation, and reconnect behavior.
5. Conversation creation, listing, resumption, renaming, and deletion.
6. Model and thinking-level selection from Pi-supported options.
7. Slash-command palette and host-controlled commands.
8. Activity trace based on actual Pi events.
9. Generic proposal/review contract with synthetic demonstration actions.
10. Manual/Auto preference persisted locally.
11. Safe Markdown rendering and accessible keyboard behavior.
12. Tests for contracts, state, accessibility, streaming, and recovery.

### Excluded

- TIA attachment, project inventory, block reads, compilation, or writes.
- Fanqi or any other Siemens bridge.
- Public or private MCP integration.
- Generic shell, filesystem, edit, or arbitrary code-execution tools exposed to the in-app model.
- Approval of PLC changes.
- Self-building plugins or executable customization.
- Cloud deployment, authentication, multi-user workspaces, billing, and SaaS concerns.

## 3. Assumptions

- Simon starts as a local, single-user Windows application.
- The backend can be Node.js/TypeScript, allowing direct use of the Pi SDK.
- The installed Pi credentials and supported model configuration remain local and are reused through Pi's supported APIs; secrets are never sent to the browser.
- The initial application has no domain database. Conversation metadata can use SQLite, while Pi retains authoritative session transcripts.
- The UI may demonstrate proposal cards with synthetic actions, but must label them as demonstrations and never claim an external change occurred.

## 4. Recommended architecture

```text
Browser
  React application shell
  Global Simon drawer
  Conversation, activity, commands, review UI
        |
        | HTTP + SSE
        v
Simon local backend (Node.js / TypeScript)
  API and event streaming
  Conversation registry
  Pi session manager
  Host command registry
  Proposal/demo service
  SQLite metadata
        |
        v
Pi SDK
  AgentSession per conversation
  Pi models and credentials
  Restricted tool set
  Session persistence and events
```

### Stack

- **Workspace:** pnpm workspaces.
- **Frontend:** React, TypeScript, Vite, React Router, Zustand, TanStack Query.
- **Backend:** Node.js, TypeScript, Fastify, Zod, SQLite.
- **Pi integration:** `@earendil-works/pi-coding-agent` SDK in-process.
- **Streaming:** SSE from backend to browser.
- **Testing:** Vitest, React Testing Library, Playwright, Fastify injection tests.
- **Formatting/linting:** ESLint and Prettier.

### Why Pi SDK rather than RPC

The proposed backend is TypeScript and local, so the SDK gives direct typed access to sessions, models, tools, and events with less protocol plumbing. Keep Pi behind a small `PiRuntime` interface so RPC can replace it later if process isolation becomes necessary.

## 5. Repository layout

```text
Simon/
  app/
    web/                    # React frontend
    server/                 # Fastify backend and Pi host
  packages/
    contracts/              # Shared API/event schemas
    assistant-core/         # Conversation and proposal domain logic
    pi-adapter/             # Pi SDK integration only
    ui/                     # Reusable UI components
  data/                     # Local runtime data; gitignored
  docs/
  tests/
    e2e/
    fixtures/
```

Do not create empty packages until their first use. A smaller initial layout may combine `assistant-core` with the server and extract it when boundaries are proven.

## 6. Core contracts

### Conversation

```text
conversation_id
pi_session_id or session file reference
title
created_at
updated_at
selected_model
thinking_level
status: idle | running | waiting_for_review | failed
```

### Run

```text
run_id
conversation_id
started_at
finished_at
status: queued | running | completed | aborted | failed
last_sequence
```

### Stream event

Every browser event must include:

```text
schema_version
run_id
conversation_id
sequence
event_type
occurred_at
payload
```

Initial event types:

```text
run.started
assistant.text.delta
assistant.message.completed
activity.started
activity.updated
activity.completed
proposal.ready
review.required
run.completed
run.aborted
run.failed
heartbeat
```

The backend maps real Pi events into these stable application events. The frontend must not depend directly on Pi's complete internal event schema.

### Proposal

The generic proposal model is retained for future engineering integration:

```text
proposal_id
conversation_id
summary
actions[]
status: pending | approved | rejected | expired | applied | failed
created_at
expires_at
content_digest
```

During this scope, only synthetic/demo actions may be produced. Approval can update demo state but cannot invoke external systems.

## 7. Manual and Auto behavior in this slice

Manual/Auto remains visible because it is part of the accepted interaction model, but its effective scope must be explicit.

- Normal conversation and read-only host operations do not require approval.
- **Manual:** a synthetic or future mutating proposal pauses for review.
- **Auto:** only actions classified by the backend as safe demo/local actions may proceed automatically.
- No mode grants shell, filesystem, MCP, TIA, publication, or external write authority.
- Changing the mode affects future runs only.
- The UI should display: `Auto execute currently covers approved local/demo actions only.`

This preserves the product concept without creating misleading authority before domain tools exist.

## 8. Slash commands

Implement a host-owned command registry. Commands are UX shortcuts, not model permissions.

Initial commands:

| Command | Behavior |
| --- | --- |
| `/new` | Start a new conversation. |
| `/conversations` | Open conversation history. |
| `/model` | Open model selection. |
| `/thinking` | Open thinking-level selection. |
| `/clear` | Clear the visible conversation after confirmation. |
| `/stop` | Abort the active Pi run. |
| `/help` | Open command/capability help. |
| `/demo-review` | Create a clearly labeled synthetic proposal card. |

Do not forward unknown slash commands silently to a shell or external runtime.

## 9. Delivery phases

### Phase 0 — Foundation and contracts

- Create the TypeScript workspace and application skeleton.
- Define shared API, event, conversation, run, and proposal schemas.
- Add SQLite metadata storage and migrations.
- Implement a fake assistant adapter for deterministic development.
- Add baseline linting, unit tests, and CI scripts.

**Acceptance:** both apps start; a fake streamed response travels through the real HTTP/SSE contract; no Pi or external service is required.

### Phase 1 — Global chat UI

- Build the application shell and global assistant drawer.
- Implement overlay, docked/pinned, mobile full-width, focus trap, focus restoration, Escape behavior, and reduced motion.
- Build conversation transcript, composer, empty/error/loading states, auto-scroll, and safe Markdown rendering.
- Persist drawer mode and Manual/Auto preferences.

**Acceptance:** drawer remains mounted across routes; keyboard and mobile behavior pass component and Playwright tests.

### Phase 2 — Pi runtime integration

- Implement the `PiRuntime` interface with the Pi SDK.
- Create one restricted `AgentSession` per conversation.
- Explicitly disable built-in write, shell, and MCP capabilities for this slice.
- Subscribe before prompting and map Pi message/run events to Simon events.
- Support abort, model selection, thinking level, session resumption, and graceful disposal.
- Keep credentials and Pi settings server-side.

**Acceptance:** a real Pi response streams into the browser; abort and provider failures are represented accurately; the browser never receives credentials.

### Phase 3 — Persistence and recovery

- Add conversation listing, naming, resumption, deletion, and transcript restoration.
- Store application metadata in SQLite and retain Pi session references.
- Add durable run status sufficient to explain interrupted sessions.
- Add SSE heartbeat, sequence replay while the server remains available, and reconnect deduplication by `run_id + sequence`.
- On server restart, mark incomplete runs interrupted rather than replaying prompts.

**Acceptance:** refresh and navigation preserve completed conversations; reconnect does not duplicate messages; restart never repeats a run automatically.

### Phase 4 — Commands, activity, and settings

- Implement command palette and slash parsing.
- Add model/thinking selectors based on Pi-supported options.
- Build activity trace from actual run/tool lifecycle events.
- Add assistant availability/status endpoint.
- Add settings for compact UI behavior and optional context/compaction preferences supported by Pi.

**Acceptance:** commands have deterministic host behavior; unsupported commands are explained; no fabricated activity appears.

### Phase 5 — Review workflow demonstration

- Add generic proposal cards, approve/reject/revise UI, expiry, and immutable content digest.
- Implement `/demo-review` with synthetic actions.
- Exercise Manual and Auto through the same proposal state machine.
- Ensure revise creates a new request rather than mutating an approved proposal.

**Acceptance:** proposal state transitions, duplicate decisions, expiry, and changed-digest rejection are tested; no external mutation occurs.

### Phase 6 — Hardening and release readiness

- Add accessibility audit, responsive QA, error-boundary tests, and safe-link policy.
- Add log redaction and local-data cleanup controls.
- Add production packaging decision and scripts for local Windows startup.
- Document setup, architecture, privacy/data flow, and known limitations.

**Acceptance:** a new user can install/start Simon, converse through Pi, resume a conversation, use commands, inspect truthful activity, and exercise a synthetic review flow.

## 10. Security and privacy requirements

- No secrets or provider credentials in browser storage, API responses, logs, or repository files.
- No arbitrary HTML rendering from assistant output.
- Validate Markdown links and block unsafe schemes.
- Restrict the Pi tool set explicitly; do not rely on prompt instructions.
- Do not load project-local Pi extensions or skills implicitly for application conversations.
- Treat conversation content as untrusted data, not system instructions.
- Avoid raw provider exceptions in the UI; retain correlation IDs for diagnostics.
- Use localhost binding by default and do not expose the local API to the LAN without a separate security decision.
- Clearly disclose that prompts and selected context may be sent to the configured model provider.

## 11. Testing strategy

### Unit

- Event mapping and sequence generation.
- Slash parsing and command routing.
- Proposal state transitions and digest checks.
- Manual/Auto policy classification.
- Markdown/link sanitization.
- Conversation metadata persistence.

### Integration

- Fastify API contracts and validation.
- Fake adapter streaming through SSE.
- Pi adapter with mocked session/events.
- Reconnect and replay behavior.
- Abort and provider-error behavior.
- Session creation/resumption/disposal.

### Component

- Drawer focus and keyboard behavior.
- Transcript streaming and scroll preservation.
- Command palette navigation.
- Proposal card decisions and disabled states.
- Activity trace grouping by unique call/event ID.

### End-to-end

- Open, pin, navigate, and retain the drawer.
- Send and stream a message.
- Abort an active run.
- Refresh and resume a conversation.
- Disconnect/reconnect SSE without duplicates.
- Use Manual and Auto demo review flows.
- Verify no TIA/MCP capability is shown as connected.

## 12. Initial decisions to record

1. **ADR-001:** TypeScript full stack with React and Fastify.
2. **ADR-002:** Pi SDK behind an application-owned adapter.
3. **ADR-003:** HTTP commands plus SSE events between browser and backend.
4. **ADR-004:** SQLite for application metadata; Pi sessions remain authoritative transcripts.
5. **ADR-005:** Restricted/no-tool Pi profile for the first slice.
6. **ADR-006:** Manual/Auto applies only to backend-classified proposal effects.
7. **ADR-007:** Generic proposal UI is implemented with synthetic actions before domain tools.

## 13. Definition of done for this slice

- Simon opens as a local application with a polished global chat drawer.
- The user can create, stream, stop, resume, rename, and delete Pi conversations.
- Model and thinking choices reflect real Pi capabilities.
- Activity indicators correspond to real runtime events.
- Slash commands are discoverable and deterministic.
- Manual/Auto and proposal review are demonstrated safely with synthetic actions.
- Refresh, reconnect, and restart behavior are explicit and tested.
- No TIA, Siemens, Fanqi, MCP, shell, or filesystem mutation capability is present or implied.
- Documentation clearly states the data flow, limitations, and next integration boundary.

## 14. Next boundary after completion

The next phase should introduce a small Simon domain-tool interface behind the existing proposal and event contracts—starting with synthetic or read-only engineering data. TIA and MCP integration should not begin until this chat/runtime foundation is stable and its security boundaries are understood.

## 15. Phase 2 amendment — restricted TIA V20 reads

The chat/runtime foundation above was completed and qualified. The original exclusions remain the definition of done for that first slice, but they no longer describe the current application boundary.

The second phase adds a Simon-owned MCP package and an incorporated, attributed TIA Portal V20/Siemens Openness worker under `mcp/worker/tia/v20/`. M1 initially exposed 18 mapped read-only tools; M2 expanded the direct TIA catalog to 20 and added three application-owned snapshot retrieval tools. Process discovery, attachment, disconnect, snapshot refresh, export, and artifact operations remain host-only. Compile, import, save, project lifecycle mutation, source generation, online PLC operations, arbitrary process execution, and arbitrary filesystem access remain blocked.

Live qualification completed through the Simon MCP façade: process discovery, attachment, state, project listing, project-tree retrieval, disconnect, and denial of a raw `SaveProject` call all succeeded. Workflow composition and approval authority remain in the application layer, not `Simon/mcp`. See `mcp/README.md`, `mcp/TOOL_MAPPING.md`, `mcp/IMPLEMENTATION_PLAN.md`, and `mcp/LIVE_QUALIFICATION.md`.

### M1 product attachment completion — 2026-11-09

The application now owns explicit TIA process discovery, process-start identity validation, conversation-scoped project bindings, connection epochs, reconnect-required restart behavior, bounded inventory, diagnostics, capability/coverage reporting, and per-tool binding guards. The model cannot discover, select, attach, detach, or switch TIA targets. Application-level live qualification confirmed explicit attachment, real project inventory, a tool-backed Pi answer, safe detach with TIA remaining open, and stale/disconnected behavior after restart.

The M1 engineering gate and localhost browser product acceptance are complete. Evidence is tracked in `docs/MANUAL_QA.md` and `docs/M2_PRODUCT_ACCEPTANCE.md`.

## 16. M2 amendment — read-only source extraction and retrieval

M2 adds direct PLC tag enumeration, controlled host-only source extraction, immutable bounded snapshots, deterministic normalization, persisted freshness and coverage, exact-before-FTS5 retrieval, exact references, stable citations, and three application-owned Pi retrieval tools. Pi cannot create or refresh snapshots, choose paths, read opaque artifacts directly, or operate TIA lifecycle controls.

Application-level live qualification covered exact path/name/tag/address retrieval, lexical retrieval, cited references, a grounded Pi answer, detach invalidation, restart staleness, and project survival. Known partials remain visible for large-program timeouts, selected path-resolution cases, nested hardware coverage, and FBD document export prerequisites.

## 17. M3 amendment — version-aware documentation and approved conventions

M3 adds a separate documentation store, bounded installed-help ZIP/HTML ingestion, deterministic normalization, applicability-first exact-before-FTS5 retrieval, stable citations, source-status UI, and two read-only Pi documentation tools. Matching installed STEP 7 V20 Update 7 help is the initial real source. Official-online ingestion remains blocked because current Siemens terms prohibit the intended automated text/data-mining use; source metadata is retained without body ingestion.

M3 also adds authorized convention inference and separate convention persistence. Drafts remain inactive. Only host-recorded engineer decisions may approve, reject, revise, or retire conventions. Approval creates append-only immutable revisions with provenance, examples, exceptions, decision metadata, and supersession links. Pi receives count and approved-search tools only.

The production loopback application was live-qualified for installed documentation status/search/citations, applicability and unknowns, rights blocking, grounded Pi answers, convention rejection/approval/revision/retirement, and restart persistence. See `docs/M3_LIVE_QUALIFICATION.md` and `docs/M3_CHECKLIST.md`.

M3 remains read-only and does not authorize compilation, save, import, source generation, project mutation, online PLC operations, documentation crawling, arbitrary URL/file ingestion, external-provider upload of Siemens content, or model-controlled approval/lifecycle operations. Electron packaging remains optional release hardening and is still deferred.
