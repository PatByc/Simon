# M3 Documentation Source Order

This document defines retrieval precedence. It does not authorize ingestion by itself. Current rights research in `docs/M3_OFFICIAL_SOURCE_RESEARCH.md` blocks automated online ingestion for M3; the online tiers remain part of the ranking model for controlled metadata/citations and for a future adapter only if rights are established.

## Target context

A documentation query may carry a bounded target context:

- product/component;
- TIA Portal major version and update;
- CPU family/model;
- firmware version;
- programming language;
- locale.

Absent fields remain unknown. Simon must not infer them from a similar topic or from model memory.

## Source classes

1. **Installed matching help** — documentation from the backend-configured local TIA installation whose product/component, major version, update, and locale match the target context.
2. **Official matching online** — allowlisted Siemens primary documentation explicitly labelled for the matching product/component and target release/update.
3. **Official same-major fallback** — Siemens primary documentation for the matching product/component and major release where the update is absent, broader, or different. The mismatch is disclosed.
4. **Official adjacent-version background** — Siemens primary documentation for another major release. It may provide background only and cannot prove target behavior.
5. **Unknown/unverified source** — missing source identity, rights, release, or applicability. It is excluded from grounded answers by default.

Community posts, search-result snippets, mirrors, aggregators, model memory, and project comments are not official documentation sources.

## Ranking rules

Applicability is evaluated before lexical relevance.

1. Reject records whose explicit scope conflicts with a known target field.
2. Rank complete explicit target matches above incomplete matches.
3. Within equivalent applicability, prefer installed matching help, then official matching online material.
4. Rank same-major fallbacks below target-update evidence and label the exact mismatch.
5. Return adjacent-version records only when the caller explicitly allows background and no target-applicable result is being represented by them.
6. Exclude unknown/unverified records from target-specific claims.
7. Within the same source/applicability tier, use exact identifiers/titles before bounded lexical score, then deterministic source/topic IDs.

## Applicability states

- `exact` — every known target field required by the source/topic matches and no known field conflicts.
- `compatible` — same product/component and major release, with one or more target dimensions not stated by the source.
- `adjacent` — explicit release/update differs but the source is retained as labelled background.
- `conflicting` — at least one explicit source/topic scope conflicts with the target; exclude from normal results.
- `unknown` — identity or applicability evidence is insufficient; exclude from grounded target claims.

`compatible` does not mean verified functional equivalence. It means no known conflict was found in the fields the source states.

## Conflict handling

- Never merge contradictory instructions into one synthesized rule.
- Return both records with their source, version, update, publication/index time, and conflict label.
- Prefer the more exact target match for the answer, but disclose the conflict.
- A newer publication date does not override a target-version mismatch.
- Project examples and approved conventions may explain local practice but cannot override official instruction semantics or safety constraints.

## Freshness

Documentation freshness is independent from engineering snapshot freshness. Every source records when it was indexed and, when available, when Siemens published or revised it. An unavailable publication date remains unknown. Refresh is a host operation and never a Pi tool.

## Citation requirements

Every result exposes a stable Simon source/topic identifier, source class, title, product/version/update labels, applicability state and reasons, locale, indexed time, content hash, extraction method, and a bounded excerpt. Raw installed paths are never part of browser or Pi citations.
