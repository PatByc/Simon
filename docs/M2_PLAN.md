# M2 Source Extraction and Retrieval Plan

**Status:** Complete
**Scope:** Read-only TIA source extraction, bounded project snapshots, exact and lexical retrieval, and grounded Pi answers.

## Safety boundary

M2 may create bounded Simon-owned temporary exports and indexes under `data/`. It must not compile, import, save, close, mutate, or operate online against a PLC. Raw local artifact paths must not be exposed to the browser or Pi.

## Steps

1. Freeze the completed M1 baseline.
2. Create an executable M2 gate.
3. Record the M2 architecture decision.
4. Define shared M2 contracts.
5. Build a live qualification matrix before expanding exposure.
6. Qualify the existing read tools individually.
7. Add direct PLC tag-table and tag enumeration.
8. Add source-extraction operations behind internal exposure.
9. Qualify source formats separately.
10. Implement a Simon-owned snapshot service.
11. Make snapshot generation bounded and resumable.
12. Persist snapshot metadata safely.
13. Implement freshness and invalidation rules.
14. Add deterministic normalization and provenance.
15. Build exact retrieval first.
16. Add lexical retrieval with SQLite FTS5.
17. Add grounded retrieval tools for Pi.
18. Guard every M2 tool with the conversation binding.
19. Add host-controlled M2 endpoints.
20. Extend the engineering-context UI.
21. Ground assistant answers in citations.
22. Add deterministic test fixtures.
23. Add application integration tests.
24. Complete read-only live qualification through Simon.
25. Synchronize capability reporting and documentation.
26. Complete the final M2 gate.
