# M3.1 Live Qualification Matrix

Status: passed — release-candidate matrix complete

This is the consolidated, sanitized release-candidate matrix for M3.1. It preserves the read-only boundary and records only bounded identifiers, outcomes, counts, citations, and screenshots under ignored `tmp/`; it does not commit project content, installed help bodies, machine paths, credentials, sessions, or generated databases.

## Environment

- Frozen M3 baseline: `e88dd31`
- Target host: Windows, loopback-only Simon, TIA Portal V20 with a user-opened project for live M1–M3 checks
- Browser widths: 360, 768, 1024, 1440, and 1920 CSS pixels
- Windows display scaling: 100%, 125%, and 150%
- Documentation: three allowlisted English STEP 7 V20 Update 7 installed-help packages
- Convention evidence: read-only browser status/history; approved-only Pi retrieval; lifecycle administration remains outside Fastify

## Matrix

| Area | Required evidence | Result |
| --- | --- | --- |
| Synthetic product | Clean production-style browser flow: create/send/search/reload/draft/actions/popovers | pass — all 9 checks true; zero console errors |
| M1 live | Explicit attach, scoped binding/epoch, grounded answer, safe detach, restart fail-closed | pass with accepted low limitation — PID/start-time binding, grounded project name, safe detach, restart disconnected/stale |
| M2 live | Current snapshot, exact/lexical retrieval, ambiguity, citations/references, stale invalidation | pass — 312 objects/46 docs partial snapshot; exact, lexical, ambiguity, reference citation, Pi grounding, detach/restart stale behavior |
| M3 live | Installed status, exact/lexical retrieval, applicability/unknowns, rights block, ambiguity, real Pi grounding | pass — 556 topics; exact/conflict/lexical/ambiguity/adjacent/rights gates; Pi cited REF source/topic/index/applicability/unknowns |
| Conventions | Proposed/active/rejected/retired/superseded read-only states; approved-only Pi guidance | pass — 1 proposed/1 active/1 rejected/1 retired, authority/details visible, zero lifecycle controls, Pi cited active immutable revision only |
| Combined answer | Independent observed-project, official-documentation, and approved-convention citations; freshness/applicability/exceptions | pass — current partial project path, exact REF documentation, active convention revision/exceptions, explicit authority and permission separation |
| Pi denial | No host lifecycle, source refresh/selection, TIA attach/detach/refresh, mutation, shell/filesystem, or PLC operation | pass — 27-tool allowlist contains read/search only; live Pi explicitly refused every prohibited category and claimed none completed |
| Responsive/scaling | Required widths and Windows display scales preserve core flows | pass — 15 width/DPR combinations, zero horizontal overflow/outside controls, settings/evidence/composer usable; mobile sidebar collapses and restores |
| Accessibility | Keyboard/focus/names/reduced motion/popovers/disclosures/errors | pass — keyboard Enter/Escape for commands/mode/model/disclosures, trigger focus restoration, zero unnamed controls, reduced-motion zero active transitions, ambiguity role alert |
| Security/privacy | Loopback/headers/CSP/cross-origin/removed routes/unsafe links/bounded payloads/ignored runtime files | pass — 127.0.0.1 only, API no-store/security headers, no CORS, removed routes 404, safe Markdown, no session/path leaks, runtime artifacts ignored |

## Final TIA state

At the final host check, TIA Portal process 1036 was responsive and its main window still showed the same `Eretech 11_06_2025` project. The project archive file's last-write time predates M3.1 live qualification; Simon invoked no compile, save, import, download, deployment, online PLC, or other mutation operation. Temporary/System metadata reflected a later TIA process restart, but the project archive itself was not rewritten by the qualification.

## Findings

Only reproducible findings are recorded here. Each finding includes severity, reproduction, disposition, regression evidence, and whether it blocks the release gate.

Finding inventory: 6 medium findings resolved; 1 low known limitation explicitly accepted; 0 open high findings; 0 open medium findings. Two provider/runtime request timeouts observed during one 100%-usage live sequence did not reproduce after restart: a fresh conversation's first run completed `READY`, so no product defect was inferred or changed for that transient observation.

### M31-PA-001 — fake-runtime transcript missing after browser reload

- Severity: medium during qualification; resolved.
- Reproduction: send a deterministic fake-runtime message, reload, reselect the conversation, and observe an empty transcript while the conversation title remains.
- Cause: `FakeAssistant.getMessages()` always returned an empty array.
- Fix: retain bounded user/assistant transcript messages in the fake adapter and return them through the existing read API.
- Regression: `app/server/src/app.test.ts` now asserts the fake user and assistant messages; clean browser acceptance confirms transcript and draft restoration after reload/reselection.
- Release status: closed.

### M31-PA-003 — SQLite BM25 relevance was ordered backwards

- Severity: medium during qualification; resolved.
- Reproduction: ask real Pi what `REF` does. The short lexical search buried the exact REF topic and returned weak unrelated matches even though full-title exact retrieval worked.
- Cause: SQLite FTS5 returns stronger BM25 matches as more-negative ranks; Simon transformed ranks with `1 / (1 + abs(rank))` and then sorted descending, inverting relevance.
- Fix: preserve BM25 magnitude as the nonnegative descending score.
- Regression: focused SQLite store test plus installed benchmark I18 require the REF topic at lexical top one. The expanded benchmark passes 37/38, lexical 7/8 (87.5%), critical failures 0. Real Pi then cited the exact REF topic, installed source, indexed time, exact applicability, firmware unknown, partial coverage, and rights-blocked online source.
- Release status: closed.

### M31-PA-004 — approved revision inherited lifecycle-stale rationale

- Severity: medium during qualification; resolved.
- Reproduction: the combined answer correctly identified an active approved convention but also quoted its inference-time rationale saying it was “not an approved rule.”
- Cause: inferred rationale encoded a temporary lifecycle state and was copied verbatim into immutable approval revisions.
- Fix: inference rationale is now lifecycle-neutral: evidence supports an inferred pattern, while only an approved immutable revision may guide. The live active convention was revised through the host CLI to immutable revision 2 with the corrected rationale and a supersession link.
- Regression: inference test requires the lifecycle-neutral wording; convention revision/immutability tests remain green.
- Release status: closed.

### M31-PA-005 — general API responses lacked explicit no-store

- Severity: medium during qualification; resolved.
- Reproduction: request `/api/v1/status`, documentation status, conventions, or conversations and inspect `Cache-Control`; only the usage route had explicit `no-store`.
- Fix: the security response hook now adds `Cache-Control: no-store` to API responses unless a route has already set a more specific policy (for example SSE).
- Regression: API status test asserts no-store and the complete header set; live probes confirm no-store on status/documentation/conventions/conversations.
- Release status: closed.

### M31-PA-006 — browser conversation payload exposed internal Pi session IDs

- Severity: medium during qualification; resolved.
- Reproduction: persisted conversations returned non-null `piSessionId` through list/single/search/create/update responses even though the browser does not require provider session identity.
- Fix: all public conversation responses now replace the internal Pi session ID with `null`; storage keeps the Simon-owned reference server-side.
- Regression: server test sets an internal provider session/path and verifies neither appears in single/list payloads; live payload scan reports only null session IDs and no path/credential patterns.
- Release status: closed.

### M31-LQ-001 — whole-project inventory request times out on the current live project

- Severity: low; accepted known engineering partial.
- Reproduction: after explicit read-only attachment to the user-opened `Eretech 11_06_2025` project, select **Inspect inventory**. The bounded request reaches its operation timeout.
- Safety behavior: Simon reports the timeout, performs no mutation, retains the binding, and a bounded snapshot still completes `partial` with 312 objects and 46 documents.
- Existing limitation: large-program/coverage timeouts were already recorded in M2/M3 qualification; the current run reproduces that limitation rather than a new authority or data-integrity defect.
- Release status: accepted for M3.1 read-only release; remains visible as partial evidence and does not authorize inference beyond collected coverage.

### M31-PA-002 — concurrent Pi session restoration races after restart

- Severity: medium during qualification; resolved.
- Reproduction: restart Simon, then select a persisted Pi conversation. Browser requests messages and branches concurrently; both attempted first-time session construction and the second path failed with `Already connected to a transport`.
- Cause: `PiAssistant.getOrCreateSession()` had no single-flight guard for concurrent initialization of the same conversation.
- Fix: added a per-conversation `SingleFlight` initialization guard with retry-after-rejection behavior.
- Regression: `single-flight.test.ts` proves concurrent sharing and recovery; live restart/reselection restored the intact transcript without the transport error.
- Release status: closed.
