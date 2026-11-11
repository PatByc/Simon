# M2 Product Acceptance Gate

**Status:** Accepted
**Baseline:** `19cae57`
**Purpose:** Manual localhost acceptance of the completed chat, M1 attachment, and M2 retrieval implementation. This gate does not reopen the completed M2 engineering gate.

## Evidence rules

- Run against the production build on `127.0.0.1`.
- Record only sanitized observations; do not record project names, paths, source, tags, process IDs, credentials, or customer data.
- A checked item requires direct browser observation on the target Windows environment.
- Findings must be reproduced before code changes and receive regression coverage where practical.
- TIA access remains read-only. No compile, import, save, project mutation, source generation, or online PLC operation is permitted.

## Setup

- [x] Working tree starts from the frozen baseline or a documented acceptance-fix commit.
- [x] `npm run typecheck`, `npm test`, and `npm run build` pass.
- [x] Production Simon starts on loopback with the expected runtime and engineering mode.
- [x] Browser console has no unexplained errors.

## Synthetic-mode acceptance

- [x] Conversation creation, streaming, stop, retry, edit/resend, branching, rename, delete, drafts, and transcript search work.
- [x] Model, thinking, approval, sidebar, and conversation preferences survive refresh/restart where specified.
- [x] Synthetic knowledge activity and citations are truthful and clearly labelled incomplete.
- [x] Synthetic proposals never claim an external or TIA change.
- [x] Reconnect, replay, interruption, and terminal run states are presented truthfully.

## M1 read-only attachment acceptance

- [x] Simon starts disconnected and never auto-attaches.
- [x] Explicit process discovery and read-only connection work from the engineering panel.
- [x] Binding identity, read-only policy, project presence, and bounded inventory are understandable.
- [x] Pi produces a real tool-grounded project answer.
- [x] Target mismatch and stale binding behavior fail closed.
- [x] Disconnect and restart require explicit reconnection while TIA and its project remain open.

## M2 snapshot and retrieval acceptance

- [x] Snapshot creation/refresh exposes state, freshness, counts, and coverage without raw local paths.
- [x] Exact engineering-path, unique-name, tag-name, and logical-address searches work.
- [x] Lexical search returns bounded cited snippets.
- [x] Duplicate names produce an actionable ambiguity response.
- [x] Exact references expose citations and partial coverage honestly.
- [x] Pi checks snapshot status, uses retrieval tools, cites engineering paths, and states freshness/coverage.
- [x] Detach and restart make prior snapshots stale and block retrieval until reconnect/refresh.

## Accessibility and responsive acceptance

- [x] All interactive controls are keyboard reachable and have visible focus.
- [x] Icon controls have accessible names and useful tooltips.
- [x] Popovers close correctly and are not clipped.
- [x] Reduced-motion behavior is respected.
- [x] Core chat and engineering flows remain usable at 360, 768, 1024, 1440, and 1920 CSS pixels.
- [x] Core layout remains usable at 100%, 125%, and 150% Windows display scaling.

## Security and privacy acceptance

- [x] Server binds to `127.0.0.1` by default.
- [x] CSP, nosniff, frame denial, no-referrer, and restrictive permissions headers are present.
- [x] Sensitive usage responses are `no-store` and contain no account identifiers or tokens.
- [x] Browser/Pi payloads contain no raw project paths, export paths, artifact paths, credentials, or proprietary evidence beyond required engineering-path citations.
- [x] Browser and Pi cannot invoke TIA lifecycle, snapshot refresh, export, artifact, compile, import, save, mutation, shell, filesystem, or online PLC operations.

## Acceptance observations

| Area | Sanitized observation | Result |
| --- | --- | --- |
| Synthetic chat | Real restricted Pi conversation streamed, exposed copy/edit/retry controls, created a two-branch response, and restored conversation-scoped drafts after switching and refresh. | accepted |
| Synthetic retrieval | Pi invoked only the bundled synthetic knowledge capability and returned cited engineering paths with explicit synthetic/partial coverage. | accepted |
| Stop and recovery | Stop produced an aborted presentation; forced server interruption produced reconnecting and clear interrupted/retry-exhaustion states without claiming success. | accepted |
| Preferences and proposals | Model/thinking controls were visible, Manual/Auto persisted across refresh, and the synthetic review flow exposed revise/reject controls and a rejected terminal state. | accepted |
| Browser runtime | Production loopback application loaded without observed console exceptions. | accepted |
| M1 attachment | Browser started disconnected, discovered one attachable process, connected read-only, displayed binding details, and exposed the bounded inventory with explicit partial coverage. | accepted |
| M1 grounding | A bound conversation received a real read-tool-backed project answer; unbound conversations failed closed rather than inheriting the active target. | accepted |
| M1 lifecycle | Browser detach left an attachable TIA process with an open project; server restart did not auto-attach and displayed explicit reconnection-required guidance. | accepted |
| M2 snapshot | Browser created a bounded current snapshot, displayed document/object/byte counts and coverage limits, and exposed no raw local paths. | accepted |
| M2 retrieval | Exact path, object name, tag name, logical address, lexical source, and duplicate-name ambiguity paths were exercised through the browser with cited engineering locations. | accepted with finding PA-001 |
| M2 grounding | Pi used snapshot status/reference retrieval, cited an engineering path, and disclosed current freshness and partial coverage without a mutation claim. | accepted |
| M2 invalidation | Browser detach removed retrieval controls; browser-originated status inspection observed the persisted snapshot as stale. | accepted |
| Responsive layout | No horizontal document overflow occurred at the five required CSS widths or three display-scale factors; the composer remained visible and mobile used the intended sidebar overlay. | accepted |
| Accessibility | Visible controls had accessible text/labels, sampled keyboard traversal reached core controls with focus indication, and reduced-motion emulation reported no running animation. | accepted with finding PA-002 |
| Security headers | The production listener bound only to loopback and returned CSP, nosniff, frame denial, no-referrer, restrictive permissions, and `no-store` usage headers. | accepted |
| Capability privacy | Runtime status exposed 23 classified read tools, no lifecycle/export/mutation/shell/filesystem tools, no mutation authority, and no account identifiers or captured raw local paths. | accepted |

## Findings and fixes

| ID | Area | Reproduction | Severity | Resolution | Verification |
| --- | --- | --- | --- | --- | --- |
| PA-001 | M2 search | Run a successful snapshot search, then submit an ambiguous exact-name query. | medium | Resolved: every new search clears the prior result before awaiting the response. | Component regression passed; repeated browser flow showed the ambiguity error with zero stale results. |
| PA-002 | Accessibility | Open the model/runtime selector and press Escape. | medium | Resolved: Escape closes the selector, stops propagation, and restores focus to the model trigger. | Keyboard component regression passed; production browser recheck confirmed close and focus restoration. |

## Acceptance record

- **Accepted:** 2026-11-11
- **Environment:** Local Windows target; Chrome 156 through loopback CDP; Pi SDK 1.5.0; TIA Portal V20; production Fastify/Vite build on `127.0.0.1:4310`.
- **Baseline:** `19cae57`, plus the product-acceptance documentation and the two verified frontend fixes recorded in this worktree.
- **Automated gate:** Server 71, web 17, contracts 13, MCP 22, and worker 2 tests passed; all workspace typechecks and production builds passed; npm audit reported zero vulnerabilities; `git diff --check` passed with line-ending warnings only.
- **Accepted limitations:** Existing documented M2 coverage partials remain; they are engineering-source limitations rather than localhost product-acceptance failures.
- **Packaging decision:** Electron packaging remains explicitly deferred. The accepted product boundary is the loopback production application.

## Exit gate

- [x] Every applicable item above is checked.
- [x] Every accepted limitation is documented.
- [x] Every code fix has relevant automated coverage and passes the full workspace gate.
- [x] `docs/MANUAL_QA.md` reflects the observed results.
- [x] Localhost product acceptance is recorded with date, environment, and commit/baseline.
- [x] Electron packaging is explicitly accepted for work or explicitly deferred.
