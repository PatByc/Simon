# M2 Source Extraction and Retrieval Gate

M2 is complete only when every applicable item below is checked with recorded evidence.

## Automated gate

- [x] Shared M2 contracts reject malformed snapshot, document, citation, coverage, tag, reference, hardware, and retrieval payloads.
- [x] Existing databases migrate additively without losing conversations, bindings, or transcript search.
- [x] Snapshot IDs, document IDs, digests, ordering, and citations are deterministic.
- [x] Snapshot generation enforces object, byte, duration, result, and concurrency limits.
- [x] Cancellation records an interrupted or partial snapshot rather than completion.
- [x] Snapshot metadata never contains a raw project path or local artifact path.
- [x] Exact lookup handles duplicate names and requires engineering-path disambiguation.
- [x] Lexical search ranks exact identifiers before FTS5 matches and returns bounded snippets.
- [x] Stale, detached, restarted, or mismatched bindings block refresh and retrieval.
- [x] Pi receives only the allowlisted M2 retrieval tools, never lifecycle or internal export tools.
- [x] Unsupported source languages and graphical formats return explicit coverage states.
- [x] Temporary artifacts are bounded, opaque, untracked, and covered by cleanup tests.
- [x] Full typecheck, tests, production builds, and `git diff --check` pass.

## Live capability qualification

- [x] Record a sanitized qualification row for each existing M1 read tool.
- [x] Qualify representative device, device-item, PLC software, block, type, and hierarchy reads.
- [x] Enumerate PLC tag tables and tags directly through Siemens Openness.
- [x] Confirm tag totals come from tag enumeration rather than source-reference inference.
- [x] Qualify representative OB, FB, FC, DB, UDT, and interface reads.
- [x] Qualify SCL extraction and record fidelity limitations.
- [x] Qualify LAD and FBD independently; unsupported or lossy results are labelled truthfully.
- [x] Qualify exact reference lookup against a known symbol without recording proprietary content.
- [x] Build a bounded snapshot through the Simon application.
- [x] Search the snapshot by exact path, exact name, tag name, logical address, and lexical phrase.
- [x] Complete a Pi answer with source-linked citations and explicit snapshot freshness.
- [x] Detach Simon and confirm subsequent snapshot refresh and retrieval are blocked.
- [x] Confirm TIA Portal and its project remain open and unchanged after qualification.

## Privacy and provenance gate

- [x] Every indexed record identifies its snapshot, binding epoch, observation time, source operation, and coverage state.
- [x] Browser and Pi responses expose engineering paths only where required for grounding.
- [x] Machine usernames, process IDs, raw project paths, export directories, and proprietary source are absent from committed evidence.
- [x] Generated snapshot contents remain under ignored runtime storage.
- [x] Logs and diagnostics report counts, digests, states, and sanitized reasons only.

## Explicitly out of scope

- [x] No compile operation is exposed or invoked.
- [x] No block, type, source, or document import is exposed or invoked.
- [x] No project save, save-as, close, or open operation is exposed or invoked.
- [x] No source generation or graphical reconstruction is exposed or invoked.
- [x] No PLC online read/write, download, upload, force, or control operation is exposed or invoked.
- [x] No embedding service, cloud index, or browser-held provider credential is introduced.
