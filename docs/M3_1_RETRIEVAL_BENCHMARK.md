# M3.1 Retrieval Benchmark

Status: passed on the M3.1 target host

## Purpose

This benchmark extends the M3 live question set into a repeatable 38-case release gate across authorized synthetic evidence and the three allowlisted installed STEP 7 V20 Update 7 packages. It measures exact-first behavior, lexical usefulness, applicability, ambiguity, fail-closed rejection, citations, deterministic output, and prompt-injection treatment without committing documentation bodies or machine paths.

Run:

```text
npm run qualify:m3.1-retrieval
```

Raw output is written only under ignored `tmp/` when retained for diagnosis.

## Matrix

- **Synthetic S01–S20:** exact title/key/alias, exact-before-lexical, incompatible CPU/language/product rejection, adjacent-version opt-in, unknown fields, firmware compatibility, duplicate ambiguity, no-result behavior, stable citations, bounded result counts, and untrusted prompt-like documentation content.
- **Installed I01–I18:** exact SCL/basic/extended instruction topics, recognized CPU conflicts, duplicate installed titles, exact stable keys, explicit unknown applicability for unsupported source dimensions, useful lexical instruction queries, a short `REF` ranking regression, a no-result query, stable citations, and one deliberately difficult semantic query.

The executable matrix is `app/server/src/testing/m3-1-retrieval-benchmark.ts`. Its synthetic half is also a deterministic Vitest regression.

## Release thresholds

1. 100% of exact expected-top-one cases pass.
2. 100% of recognized incompatible, adjacent-disallowed, ambiguity, and no-result safety cases pass.
3. 100% of returned hits carry a stable SHA-256 citation ID and explicit applicability reasons.
4. At least 85% of lexical expected-top-five cases pass.
5. Synthetic results are byte-for-byte deterministic across repeated runs.
6. No medium/high retrieval defect remains unresolved. A bounded low-severity lexical miss may remain only when exact retrieval, applicability, citations, and safety thresholds still pass and the limitation is explicit.

Embeddings or reranking are not authorized unless this benchmark demonstrates a material lexical failure against these thresholds.

## Result

| Measure | Result | Threshold |
| --- | ---: | ---: |
| Cases | 38 | 30–40 |
| Passing cases | 37 | informational |
| Critical failures | 0 | 0 |
| Synthetic | 20/20 | 100% |
| Installed | 17/18 | safety gates 100% |
| Lexical expected top five | 7/8 (87.5%) | at least 85% |
| Exact/safety/applicability/citation gates | 100% | 100% |
| Synthetic repeat determinism | pass | pass |

The first installed calibration run produced four expectation mismatches. Three topics were correctly classified `compatible`, not `exact`, because installed help did not state the requested language. One S7-300/S7-400 title remained `compatible` because that CPU family is outside the current bounded extractor and therefore explicit unknown evidence, not a recognized conflict. The benchmark expectations were corrected; no production behavior was changed to hide unknown applicability.

Live Pi qualification exposed a real SQLite BM25 ordering defect: stronger matches have more-negative BM25 ranks, but Simon converted them with `1 / (1 + abs(rank))`, which inverted relevance and caused a short `REF` query to bury the exact REF topic. Simon now uses the BM25 magnitude as the descending relevance score. A focused SQLite regression and installed I18 case prove `REF: Create a reference to a tag (S7-1500)` ranks first; the full benchmark remains above threshold.

I14 remains a low-severity lexical limitation: the underspecified query `technology object reference firmware` finds topics containing all terms but does not place a technology-object overview in the top five. Exact retrieval, recognized incompatibility rejection, no-result behavior, citations, and all other lexical cases pass. This does not meet the agreed material-failure threshold for adding embeddings; the limitation remains explicit for future corpus/ranking work.

## Privacy and authority

The committed matrix contains only bounded queries, topic titles, stable keys, applicability targets, and expected outcomes. It contains no installed documentation body, local installation path, customer project data, credentials, conversation text, or generated database. Retrieved text remains untrusted evidence and grants no runtime or engineering authority.
