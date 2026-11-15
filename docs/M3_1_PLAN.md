# M3.1 Stabilization and Productization Plan

**Status:** Active
**Baseline:** Frozen M3 baseline `e88dd31`
**Scope:** Post-M3 regression, host-boundary correction, read-only convention evidence UI, startup/index resilience, measured retrieval evaluation, and release-candidate acceptance.

## Safety boundary

M3.1 remains read-only and does not authorize compile, save, import, export, source generation, project mutation, online PLC operations, arbitrary URL/file ingestion, documentation crawling, shell/filesystem access, or model-controlled lifecycle actions. Electron packaging and all M4 write experiments remain deferred.

## Ordered steps

1. Freeze `e88dd31` as the immutable M3 baseline and verify local/upstream state.
2. Add the executable M3.1 plan, checklist, and progress ledger.
3. Record the M3.1 architecture decision: no authority expansion, read-only convention visibility, and no convention mutation on the browser/Pi HTTP surface.
4. Reassert the M3.1 safety boundary.
5. Audit every production HTTP route and Pi tool against the browser/Pi authority matrix.
6. Remove convention proposal/decision/revision/retirement operations from ordinary production HTTP.
7. Add regression tests denying browser-reachable convention lifecycle mutation.
8. Preserve convention lifecycle through an explicit Simon-owned host administration interface.
9. Restrict host administration to bounded opaque identifiers, explicit confirmation, validated actor/note fields, and Simon-owned storage.
10. Derive inference examples from current Simon-owned snapshots or explicitly authorized synthetic fixtures.
11. Add host-interface lifecycle, validation, immutability, and restart tests.
12. Define runtime-validated read-only convention summary/history contracts.
13. Add browser API functions for convention status/history only.
14. Build a read-only `ConventionEvidencePanel` in Simon's established industrial/refined design language.
15. Show proposed, active, retired/superseded, and rejected states without promoting drafts.
16. Expose rule, authority, scope, confidence, evidence, exceptions, revision, decision, and supersession details.
17. Label inferred, approved, retired, and superseded states truthfully.
18. Expose no convention mutation controls in the browser.
19. Add bounded loading, empty, partial, corrupt-history, and unavailable states.
20. Add accessible component tests and verify the absence of mutation controls.
21. Integrate convention evidence without merging knowledge authority classes.
22. Measure clean, warm, missing-source, unchanged-source, and failed-ingestion startup behavior before optimization.
23. Define and record engineer-approved startup budgets from measured behavior.
24. Add an isolated production-startup test harness.
25. Verify clean-data database creation, source initialization, UI readiness, and path privacy.
26. Verify warm-restart persistence across conversations, documentation, conventions, and stale engineering snapshots.
27. Make installed-help initialization deterministic and idempotent across unchanged restarts.
28. Prevent a failed reindex from destroying the last known-good documentation index.
29. Test missing/corrupt/unsafe/oversized/interrupted/locked initialization and recovery.
30. Measure sanitized indexing time, topic count, search latency, database growth, and readiness.
31. Optimize only when an approved startup budget is missed.
32. Expand the engineer-approved retrieval benchmark to approximately 30–40 cases.
33. Approve safety, citation, ambiguity, applicability, and lexical top-k thresholds before execution.
34. Implement a deterministic retrieval benchmark runner.
35. Run the benchmark against synthetic and installed V20 sources with sanitized output.
36. Fix only measured retrieval failures; keep embeddings/reranking deferred without evidence.
37. Create the M3.1 live qualification matrix.
38. Rerun complete synthetic browser acceptance.
39. Rerun M1 browser qualification against a user-opened TIA V20 project.
40. Rerun M2 browser qualification.
41. Rerun M3 documentation qualification through production Simon and real Pi.
42. Qualify the read-only convention panel and approved-only guidance.
43. Run one combined live project/documentation/convention conversation.
44. Require independent authority citations, freshness/applicability, exceptions, and no permission merging.
45. Verify Pi cannot perform host-only lifecycle, refresh, selection, attachment, or mutation actions.
46. Repeat responsive checks at required widths and Windows scaling levels.
47. Repeat keyboard, focus, reduced-motion, accessible-name, popover, and disclosure checks.
48. Repeat browser security, privacy, cross-origin, and removed-route checks.
49. Record, reproduce, and regression-test only demonstrated findings.
50. Run the complete workspace typecheck, test, build, audit, privacy, runtime-file, and diff gate.
51. Confirm TIA Portal and its project remain open and unchanged.
52. Synchronize authoritative product, architecture, behavior, flow, roadmap, and capability documentation.
53. Record `docs/M3_1_PRODUCT_ACCEPTANCE.md` with sanitized release-candidate evidence.
54. Require a clean M3.1 exit gate with no unresolved high/medium findings.
55. Freeze and push the M3.1 baseline only after every gate passes.
56. Make a separate post-M3.1 decision between desktop packaging and a new M4 disposable-project research plan.

## Acceptance principle

M3.1 is complete only when the post-M3 product passes one consolidated release-candidate gate, convention lifecycle mutation is absent from browser/Pi HTTP authority, last known-good documentation survives failed refreshes, retrieval quality is measured against an approved benchmark, and combined evidence remains distinctly cited and read-only.
