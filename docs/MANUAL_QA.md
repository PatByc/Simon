# Simon Manual QA Checklist

Automated browser E2E testing is intentionally deferred. Complete this checklist before desktop packaging or regular use.

## Localhost acceptance checkpoint — 2026-11-11

The focused localhost product gate in `docs/M2_PRODUCT_ACCEPTANCE.md` was completed against the production loopback application. It covered synthetic chat/runtime behavior, explicit M1 attachment, M2 snapshot/retrieval flows, keyboard/accessibility sampling, required responsive widths and display scales, security headers, privacy boundaries, safe detach, and restart behavior. Two observed frontend defects were fixed and browser-reverified: stale search results after an ambiguous query and the model selector not closing on Escape. The full automated workspace gate passed afterward. Electron packaging remains deferred. Unchecked granular items below remain useful as repeatable release-regression checks and are not claims of unobserved behavior.

## Setup

```powershell
npm install
npm run typecheck
npm test
npm run build
./scripts/start-simon.ps1 -Runtime pi
```

Open `http://127.0.0.1:4310`.

## Application frame

- [ ] Simon opens as a full-window chat interface without console errors.
- [ ] Refreshing `/` restores the application.
- [ ] The server binds to `127.0.0.1` by default.
- [ ] Header, sidebar, transcript, and composer fit at 100%, 125%, and 150% display scaling.
- [ ] Reduced-motion preference removes meaningful animation.

## Sidebar and history

- [ ] Sidebar collapses and restores its preference after refresh.
- [ ] New conversation clears the visible transcript without deleting history.
- [ ] Selecting a conversation shows a loading skeleton before restoration.
- [ ] Active conversation highlighting is accurate.
- [ ] Rename and delete work with mouse and keyboard.
- [ ] Deleting a conversation removes its Pi transcript and search records.
- [ ] Mobile sidebar behaves as an overlay and closes after selection.

## Local transcript search

- [ ] Search matches conversation titles.
- [ ] Search matches user prompts.
- [ ] Search matches assistant responses.
- [ ] Results show a truthful role and excerpt.
- [ ] Selecting a result restores the correct conversation.
- [ ] No search request reaches an external provider or model.

## Composer

- [ ] Enter sends and Shift+Enter inserts a line.
- [ ] The textarea expands until its maximum height, then scrolls internally.
- [ ] Unsent drafts survive refresh and conversation switching.
- [ ] Failed submissions preserve their drafts.
- [ ] Successful submissions clear only the relevant draft.
- [ ] Plus opens slash commands.
- [ ] Approval icon opens the compact Manual/Auto menu.
- [ ] Nothing is rendered beneath the composer bar.

## Conversation and messages

- [ ] A normal prompt streams a real Pi response.
- [ ] Scrolling upward prevents streaming from pulling the view down.
- [ ] Latest appears when newer content is below and returns to the bottom.
- [ ] Copy response copies the complete response.
- [ ] Copy code copies only the fenced code.
- [ ] Retry generates an alternative response branch.
- [ ] Edit and resend creates a branch from the chosen user prompt.
- [ ] Branch selector switches transcripts without rerunning the model.
- [ ] Branch selection survives a server restart.
- [ ] Long Markdown, tables, lists, and code blocks remain usable.

## Stop and recovery

- [ ] Stop produces an aborted state rather than completed.
- [ ] Interrupted server runs display the recovery notice after restart.
- [ ] SSE disconnect shows Reconnecting with attempt information.
- [ ] Recovery shows Connection restored.
- [ ] Replayed events are not duplicated.
- [ ] Retry exhaustion shows a clear terminal connection error.

## Runtime controls

- [ ] Header shows Pi ready and a nonzero model count.
- [ ] Settings lists available Pi models.
- [ ] Model and thinking changes survive a server restart.
- [ ] Runtime changes are rejected during an active run.
- [ ] Missing credentials/models disable the composer with a clear reason.
- [ ] Synthetic mode lists only `simon_search_synthetic_knowledge`.
- [ ] TIA read-only mode lists exactly the classified Simon TIA read tools.
- [ ] Shell, arbitrary filesystem, browser, internet, compile, save, import, mutation, and online PLC access remain disabled in every mode.

## Usage indicator

- [ ] The top-right circular ring reflects the real 5h used percentage.
- [ ] The lightning remains centered and legible.
- [ ] Hover and click reveal the popover above all other UI.
- [ ] Popover shows 5h and 7d used, available, and reset timing.
- [ ] API/browser responses contain no email, user ID, account ID, or access token.
- [ ] Usage refreshes without reloading the page.

## Synthetic knowledge tool

Ask:

```text
Search the synthetic examples for pump restart logic and cite the sources.
```

- [ ] Pi invokes only the allowlisted synthetic search tool.
- [ ] Activity shows the real tool start and completion.
- [ ] Source cards match returned paths and excerpts.
- [ ] Simon explicitly says the results are synthetic and incomplete.
- [ ] Simon does not claim access to a real TIA project.

## M1 TIA read-only attachment

Start with:

```powershell
./scripts/start-simon.ps1 -EngineeringMode tia-readonly
```

- [ ] Settings initially shows TIA disconnected; no automatic attachment occurs.
- [ ] Discover TIA processes lists PID, stable process start time, discovery time, and open-project availability.
- [ ] The user must explicitly choose a process and select Connect read only.
- [ ] The bound project name, read-only state, observation time, and binding ID are visible.
- [ ] Inspect inventory returns the bounded project hierarchy and explicit coverage limitations.
- [ ] Asking which project is connected produces a real tool-backed answer.
- [ ] Disconnect Simon leaves TIA Portal and the project open.
- [ ] Restarting Simon shows Reconnect required for the saved conversation.
- [ ] A conversation already bound to another target cannot silently switch projects.
- [ ] The engineering controls are keyboard-operable at desktop and mobile widths.

See `docs/M1_CHECKLIST.md` for the complete automated and live gate.

## M2 engineering snapshot and retrieval

With the same explicit read-only connection:

- [ ] Create a snapshot and verify state, freshness, object/document counts, and coverage notes are visible.
- [ ] Search by a known engineering path, unique object name, PLC tag name, logical address, and source phrase.
- [ ] Every result shows a bounded snippet and engineering-path citation without exposing a local filesystem path.
- [ ] Duplicate names produce an ambiguity error that requires an engineering path.
- [ ] Exact reference lookup reports partial coverage honestly where applicable.
- [ ] Ask Pi to answer from the snapshot; it checks status first, uses retrieval tools, cites paths, and states freshness/coverage limits.
- [ ] Refresh creates or resumes only the current conversation/binding snapshot and never accepts a caller path.
- [ ] Disconnect makes the snapshot stale and blocks search/reference retrieval until explicit reconnect and refresh.
- [ ] Restart makes persisted snapshots stale and requires explicit reconnect/refresh.
- [ ] TIA Portal and the project remain open and unmodified throughout.

See `docs/M2_CHECKLIST.md` and `mcp/M2_LIVE_QUALIFICATION.md` for the complete automated and sanitized live gate.

## Approval demonstration

- [ ] Manual is the clean-profile default.
- [ ] Manual/Auto preference survives refresh.
- [ ] `/demo-review` creates a pending synthetic proposal.
- [ ] Approve, Reject, and Revise update exactly once.
- [ ] Auto applies only the safe synthetic demonstration.
- [ ] No UI claims an external or TIA change occurred.

## Accessibility and responsive behavior

- [ ] Every icon has an accessible name and styled tooltip.
- [ ] All controls are keyboard reachable.
- [ ] Focus indicators remain visible.
- [ ] Popovers close on outside click and Escape where applicable.
- [ ] Tooltips and popovers are not clipped at viewport edges.
- [ ] Scrollbars match the theme and remain usable with mouse and touchpad.
- [ ] Test widths: 360, 768, 1024, 1440, and 1920 pixels.

## Production security

Confirm responses contain:

- [ ] `Content-Security-Policy`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY`
- [ ] `Referrer-Policy: no-referrer`
- [ ] restrictive `Permissions-Policy`
- [ ] `Cache-Control: no-store` on `/api/v1/usage`

## Intentional exclusions

- Engineering mutations or model-controlled TIA lifecycle, snapshot refresh, export, or artifact operations
- Compile, import, save, download, project close, or online operations
- Unrestricted/raw MCP exposure to the browser or Pi
- General shell, filesystem, browser, or internet tools
- Multi-user authentication and cloud deployment
- Playwright/browser automation
- Electron packaging until localhost qualification is accepted
