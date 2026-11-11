# M3 Documentation and Approved Conventions Gate

M3 is complete only when every applicable item below is checked with durable evidence.

## Automated gate

- [x] Documentation, applicability, source, citation, search, convention, approval, and revision payloads are runtime validated.
- [x] Unknown product version, update, CPU, firmware, language, or instruction applicability remains unknown.
- [x] Documentation metadata and search records persist separately from engineering snapshots.
- [x] Normalized document IDs, hashes, ordering, chunks, snippets, and citations are deterministic.
- [x] Ingestion enforces source, URL/path, object, byte, duration, and concurrency limits.
- [x] Exact topic/instruction retrieval precedes bounded lexical retrieval.
- [x] Target-version sources rank above adjacent-version background and every result exposes applicability.
- [x] Documentation and project text cannot inject runtime instructions or change capability policy.
- [x] Pi receives only status/search retrieval tools, never ingestion, refresh, arbitrary URL/file, or approval tools.
- [x] Convention drafts cannot become active without a host-recorded engineer decision.
- [x] Approved convention revisions are immutable and retain examples, exceptions, provenance, and decision metadata.
- [x] Deterministic checks are labelled as checks, never functional verification.
- [x] Full workspace typecheck, tests, production builds, audit, and `git diff --check` pass.

## Source and rights gate

- [x] Installed V20 help discovery uses only authorized inspection and records source identity and limitations.
- [x] Official online sources are primary Siemens sources with explicit product/version labels where available.
- [x] Local proprietary help content, manuals, binaries, schemas, and customer artifacts remain outside the repository.
- [x] Redistribution and external-provider use are not assumed; uncertain rights fail closed.
- [x] Source and indexed-topic records include extraction method, content hash, indexed time, and applicability inputs/state as applicable.
- [x] Adjacent or unknown versions are never presented as target-specific proof.

## Live documentation qualification

- [x] An engineer-approved question set identifies expected topics, versions, and acceptable missing-evidence outcomes.
- [x] Simon retrieves an exact target-applicable instruction topic with a stable citation.
- [x] Simon retrieves a lexical topic and discloses applicability and freshness.
- [x] Duplicate instruction names require source/version disambiguation.
- [x] Missing target-version evidence is reported rather than filled from model memory.
- [x] Adjacent-version guidance is explicitly labelled background.
- [x] Malicious or instruction-like document text is treated as quoted data and cannot trigger actions.
- [x] Pi answers cite applicable sources and state version/update constraints.

## Live convention qualification

- [x] Authorized examples produce a draft with representative evidence and explicit exceptions.
- [x] Inferred patterns remain inactive until engineer approval.
- [x] Approval, revision, rejection, and retirement are host-controlled and auditable.
- [x] A rejected draft does not affect assistant guidance.
- [x] An approved revision is retrieved with its immutable revision ID and provenance.
- [x] Project evidence, official documentation, inferred conventions, and approved conventions remain visually and contractually distinct.

## Privacy and safety gate

- [x] Committed evidence contains no customer documentation, proprietary source, raw local paths, credentials, sessions, or machine identifiers.
- [x] Browser and Pi receive bounded excerpts and citations, not raw local source locations.
- [x] Generated indexes and source snapshots remain under ignored runtime storage.
- [x] M3 exposes no compile, import, save, project mutation, source generation, TIA lifecycle, online PLC, shell, filesystem, or arbitrary network capability.
- [x] TIA Portal and the engineer's project remain open and unchanged during live qualification.
