# M3 Live Qualification

**Date:** 2026-11-11
**Application:** Production Simon loopback build with real Pi runtime
**Engineering mode:** Synthetic for documentation qualification; no TIA attachment was required or created
**Documentation target:** Installed STEP 7 V20 Update 7 English help

Committed evidence is sanitized. Raw API/browser/Pi captures remain under ignored `tmp/` and runtime databases/logs remain under ignored `data/`.

## Documentation source initialization

- Simon indexed 556 normalized topics from the three configured, allowlisted installed STEP 7 packages.
- Installed help reported `ready`, `local-only`, V20, Update 7, en-US.
- The TIA Documentation Portal source reported `blocked` with zero indexed body content because automated online ingestion is rights-blocked.
- Overall documentation status reported partial because the official-online source is deliberately blocked, not because installed ingestion failed.
- No browser/API source record exposed the configured installed-help root.

## Live defects found and corrected

1. Siemens help ZIPs use backslashes as internal entry separators for some metadata files. The bounded ZIP reader initially rejected them. It now normalizes archive separators before traversal checks; `..` traversal remains rejected. Server tests remained green and live ingestion completed.
2. When an exact title existed but conflicted with the requested CPU target, retrieval initially fell through to unrelated lexical lookalikes. Retrieval now records the exact candidate and returns no result rather than substituting lexical content. A regression test covers this branch.

## Question-set results

| ID | Result |
| --- | --- |
| DQ-01 | Passed. Exact-title retrieval returned the installed V20 Update 7 S7-1500 REF topic with an `exact` applicability result and stable Simon citation. |
| DQ-02 | Passed fail-closed. The multi-term lexical query returned zero results; Simon did not broaden or invent an answer. |
| DQ-03 | Passed after the live-found fix. The explicit S7-1500 REF topic returned zero hits for an S7-1200 target and no lexical substitute. |
| DQ-04 | Passed. The firmware-targeted lexical query returned bounded results labelled `compatible`; firmware was reported as unstated rather than exact. |
| DQ-05 | Passed through the deterministic M3 integration fixture. Duplicate exact titles raise disambiguation instead of selecting silently. |
| DQ-06 | Passed. Installed source and rights-blocked online source remained separate; documentation status was independent of engineering snapshots. |
| DQ-07 | Passed through the production browser and real Pi. Pi checked status, used documentation search, cited the installed source and exact REF topic, stated V20 Update 7 / S7-1500 / SCL applicability, disclosed unknown CPU-model/firmware applicability, and noted the online rights block. |
| DQ-08 | Passed through deterministic integration/prompt tests. Instruction-like documentation text remains returned as untrusted data; runtime policy exposes no host-only or mutation operation. |

## Browser verification

- The settings UI displayed 556 topics, one current local source, one blocked online source, and partial source-set coverage.
- Exact REF search displayed source identity, stable package/topic key, V20 Update 7 labels, applicability, and bounded evidence.
- Target fields were keyboard-labelled and editable.
- No horizontal overflow occurred at desktop width or 360 CSS pixels.
- Browser console reported no qualification errors.

## Pi grounding observation

The grounded answer described REF as assigning a previously declared reference to a tag/address, cited `STEP 7 installed help V20 Update 7` and the exact REF topic, included the stable package/topic key and indexed time, and separated established target applicability from unknown CPU-model/firmware details. It made no compile, save, download, or mutation claim.

## Safety result

Documentation retrieval remained local and read-only. The live run did not crawl Siemens online sources, upload Siemens documentation to an external ingestion service, attach to TIA, refresh engineering snapshots, compile, save, import, generate sources, mutate a project, or access a PLC.

## Convention qualification

A host-scripted flow used synthetic, explicitly authorized project examples so no customer naming evidence was committed.

- **CQ-01 passed:** Four authorized examples produced one proposed `FB_` naming draft with three representative citations and the explicit `LegacyMixer` exception. Active approved count remained zero.
- **CQ-02 passed:** The first draft was rejected by a host-recorded engineer decision. Rejected count increased and no active guidance was created.
- **CQ-03 passed:** A second independently evidenced draft was approved. Revision 1 became active with immutable revision and decision IDs. Real Pi used only approved-convention tools, cited the full revision ID and all three representative project citations, disclosed the exception, and stated that the rule was local practice rather than Siemens product documentation. It explicitly said rejected proposals were not used as rules.
- **CQ-04 passed:** A host revision appended revision 2 with a supersession link and clarified scope/exception. Retirement appended revision 3. History retained actions `approve`, `supersede`, and `retire` in order. Active guidance became empty and the retired revision remained readable.
- **Restart passed:** After restarting production Simon, proposed count remained zero, active count remained zero, revision 3 remained retired, and rejected count remained one.

Pi received count and approved-search tools only. It had no proposal, approve, reject, revise, retire, or activate tool and made no external mutation claim.

## Final automated and privacy gate

- All workspace typechecks passed.
- Tests passed: server 118, web 19, contracts 18, MCP TypeScript 22, and TIA V20 worker 2.
- All production builds passed, including the web bundle and TIA V20 worker.
- `npm audit --audit-level=high` reported zero vulnerabilities.
- `git diff --check` passed with line-ending warnings only; untracked new-source checks also passed.
- Added-line privacy scans found no raw user path, credential assignment, private key, or non-loopback listener.
- Runtime storage remained ignored; only the intentional `data/.gitkeep` is tracked.
- All pre-existing TIA Portal processes retained the same process start identities across the final gate. M3 did not attach to, close, save, compile, or mutate them.

## Retained limitations

- Real ingestion is intentionally limited to three allowlisted English STEP 7 ZIP/HTML packages. CHM, PDF, broader package coverage, and other locales remain deferred.
- Official-online body ingestion remains blocked pending separately verified rights; robots metadata is not treated as copying permission.
- Installed metadata does not establish every topic's CPU model, firmware, language, or release applicability; missing fields remain unknown.
- Adjacent-version and conflict behavior is qualified deterministically, but no adjacent installed package is configured in the production source set.
- Embeddings/reranking remain deferred until engineer-approved retrieval evaluation demonstrates a measured FTS5 failure.
- Existing M2 partials remain unchanged, including selected path-resolution cases, nested hardware coverage, large-program timeouts, and FBD export prerequisites.
- Electron packaging remains deferred; the accepted boundary is the loopback production application.
