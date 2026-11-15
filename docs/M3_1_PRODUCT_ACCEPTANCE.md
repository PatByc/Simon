# M3.1 Product Acceptance

**Result:** PASS — accepted M3.1 baseline frozen in Step 55
**Frozen input baseline:** M3 `e88dd31`
**Scope:** Read-only stabilization and productization only. No TIA/PLC/documentation-source/convention-lifecycle authority expansion.

## Environment

- Windows target host; Node `v26.13.0`; npm `12.2.2`; .NET SDK `8.0.427`
- Production Simon bound to `127.0.0.1:4310`
- Pi runtime with 8 available models and 27 explicitly allowlisted read/status/search tools
- TIA Portal V20 user-opened project: `Eretech 11_06_2025`
- Documentation: three allowlisted English STEP 7 V20 Update 7 installed-help packages, 556 topics
- Browser qualification: headless Chrome/CDP plus prior user-browser live qualification
- Baselines preserved: M1 `6931d18`, M2 `19cae57`, M3 `e88dd31`

## Accepted product boundary

- Browser convention access is status/history only. Ordinary Fastify exposes no convention proposal, approval, rejection, revision, retirement, or activation route.
- Convention lifecycle uses a separate direct-service host CLI with bounded IDs/text/lists and explicit `--confirm`.
- Pi cannot select/attach/detach TIA, refresh snapshots, ingest/refresh documentation, choose URLs/files, manage conventions, use shell/filesystem, compile/save/import/download, or operate a PLC.
- Project, documentation, inferred-convention, and approved-convention evidence remain distinct. Evidence and approvals grant no runtime permission.
- Provider credentials, internal Pi session IDs/paths, raw installed roots, generated databases, logs, screenshots, and proprietary bodies remain outside browser payloads and committed evidence.

## Acceptance matrix

| Area | Result | Evidence |
| --- | --- | --- |
| Authority correction | Pass | Four browser-reachable convention mutation route classes removed; five direct removed-route probes return 404; host CLI lifecycle tests pass. |
| Read-only convention UI | Pass | Proposed/active/rejected/retired states, authority, evidence, exceptions, decisions, revision/supersession details; zero lifecycle controls. |
| Startup/index resilience | Pass | Unchanged fingerprint reuse, atomic replacement, last-known-good stale retention/recovery, missing/corrupt/unsafe/oversized/interrupted/locked coverage. |
| Retrieval quality | Pass | 38 cases; 37 pass; critical failures 0; exact/safety/citation gates 100%; lexical expected-top-five 7/8 (87.5%). |
| Synthetic product | Pass | Send/stream/actions/search/popovers/draft/transcript reload; zero console errors after fixes. |
| M1 live | Pass with low limitation | Explicit PID/start-time attach and epoch binding, grounded read-only answer, safe detach, restart disconnected/stale, TIA project survives. |
| M2 live | Pass | Current partial 312-object/46-document snapshot; exact/lexical/ambiguity/reference citations; Pi freshness/coverage grounding; stale invalidation. |
| M3 live | Pass | 556 topics; ready local + rights-blocked online status; exact/conflict/lexical/ambiguity/adjacent behavior; grounded REF answer. |
| Conventions | Pass | Current-snapshot inference, host approval/revision, immutable history, approved-only Pi guidance, proposed/rejected/retired exclusion. |
| Combined authority | Pass | One answer independently cited current project path, exact Siemens topic, active local convention revision, freshness/applicability/exceptions, and no permission merge. |
| Pi denials | Pass | Live adversarial request refused every host lifecycle, mutation, I/O, and PLC category and claimed none completed. |
| Responsive/scaling | Pass | 360/768/1024/1440/1920 CSS px × DPR 1/1.25/1.5; no overflow/outside controls; mobile sidebar collapses. |
| Accessibility | Pass | Keyboard popovers/disclosures, Escape focus restoration, names, reduced motion, role-alert error state, zero JS exceptions. |
| Security/privacy | Pass | Loopback only; no-store; CSP/frame denial/nosniff/no-referrer/permissions; no CORS; safe links; no path/credential/provider-session leak; runtime files ignored. |
| Final workspace gate | Pass | All typechecks/tests/builds, audit, startup/retrieval gates, privacy checks, and `git diff --check`. |

## Final measured gates

### Startup/index

| Scenario | Application ready | Documentation terminal after listener | Assistant ready | Exact search |
| --- | ---: | ---: | ---: | ---: |
| Clean installed, fake | 1.49 s | 1.28 s | 1.49 s | 23.4 ms |
| Warm unchanged, fake | 1.42 s | 10 ms | 1.42 s | 16.8 ms |
| Warm unchanged, Pi | 5.51 s | 7 ms | 5.54 s | 16.9 ms |
| Missing root, fake | 1.60 s | 402 ms | 1.60 s | n/a |
| Corrupt packages, fake | 1.44 s | 455 ms | 1.44 s | n/a |

Clean/warm installed runtime bytes were identical at 14,333,304. These final warm-host values pass the documented target-host budgets; budgets remain the release contract rather than universal hardware guarantees.

### Automated gate

- Server: 35 test files, 140 tests
- Web: 7 files, 23 tests
- Contracts: 1 file, 18 tests
- MCP TypeScript: 9 files, 22 tests
- TIA worker: 2 tests
- Typechecks/builds: pass across all workspaces; worker build has 0 warnings/errors
- Audit: 0 vulnerabilities
- Retrieval: 38 cases, critical failures 0, lexical 87.5%
- Diff/privacy: `git diff --check` pass; only `data/.gitkeep` tracked under runtime roots

## Findings and disposition

| ID | Severity | Disposition |
| --- | --- | --- |
| M31-PA-001 fake transcript absent after reload | Medium | Fixed; fake transcript API regression + browser recheck. |
| M31-PA-002 concurrent Pi session restoration race | Medium | Fixed; per-conversation single-flight + live restart recheck. |
| M31-PA-003 SQLite BM25 order inverted | Medium | Fixed; SQLite rank regression + installed I18 + real Pi recheck. |
| M31-PA-004 lifecycle-stale approved rationale | Medium | Fixed; lifecycle-neutral inference wording + immutable live revision 2. |
| M31-PA-005 API responses lacked general no-store | Medium | Fixed; security hook/test/live header probes. |
| M31-PA-006 internal Pi session IDs exposed | Medium | Fixed; public conversation sanitization/test/live payload scan. |
| M31-LQ-001 whole-project inventory timeout | Low | Accepted. Current project snapshot still completed partial with explicit coverage. |

Open high findings: 0. Open medium findings: 0.

## Accepted limitations

- Whole-project inventory can time out on the current large project. Snapshot coverage remains explicit: one software container's block collection failed, another was partial, and references are bounded.
- Existing engineering partials remain for selected path normalization, nested hardware, large-program operations, and FBD SD export prerequisites.
- Retrieval case I14 remains one low semantic lexical miss; exact/safety/citation thresholds pass, so embeddings/reranking remain deferred.
- Official-online Siemens body ingestion remains rights-blocked.
- Default Pi cold startup remains bounded by Pi/module initialization; Simon opens only after that initialization to avoid a post-paint event-loop freeze.
- Electron packaging is not part of this accepted baseline.

## TIA project safety

The final host check found TIA Portal responsive with the same project window. The `.ap20` archive last-write predates M3.1 live qualification. Simon exposed or invoked no compile, save, import, download, deployment, source-generation, online PLC, or other project mutation operation.

## Decision

M3.1 meets its release-candidate exit conditions and is frozen only after the final checklist/diff review passed. This acceptance does not authorize M4 writes.

## Post-M3.1 sequence decision

Step 56 selects desktop packaging as the next planning track. Packaging must preserve the accepted read-only authority boundary and receive its own executable plan and acceptance gate. M4 disposable-project write research remains unauthorized.
