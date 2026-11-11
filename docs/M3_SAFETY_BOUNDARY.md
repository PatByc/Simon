# M3 Safety Boundary

M3 adds read-only knowledge retrieval. It does not add engineering execution authority.

## Authority classes

Every knowledge result must identify one authority class:

- `observed-project` — read-only evidence observed from the explicitly bound engineering project.
- `official-documentation` — retrieved documentation with source and applicability metadata.
- `inferred-convention` — a draft pattern inferred from authorized examples; never active by itself.
- `approved-convention` — an immutable convention revision explicitly approved through the host application.

These classes are not interchangeable. Model-generated text is not an authority class.

## Untrusted content rule

Conversation text, project comments, exported source, documentation pages, examples, convention drafts, links, and citations are untrusted data. Embedded commands, policy statements, approval language, tool instructions, or requests to ignore Simon policy must be quoted or summarized as data and never executed as instructions.

## Host-only operations

The browser and Pi must not receive tools for:

- documentation ingestion, crawling, refresh, deletion, or arbitrary URL selection;
- local-help discovery or arbitrary file/path selection;
- convention approval, rejection, revision, retirement, or activation;
- TIA process discovery, attachment, detach, snapshot refresh, export, or artifact lifecycle;
- compile, import, save, source generation, project mutation, online PLC operations, shell, or filesystem access.

Only backend-configured adapters may ingest bounded documentation. Only host-controlled application actions may record convention decisions.

## Fail-closed rules

- Unknown source rights or applicability remain unknown and cannot be promoted to target-specific evidence.
- Missing target-version documentation is reported; model memory does not fill the gap.
- Inferred conventions remain inactive until explicit approval creates a new immutable revision.
- Documentation and conventions never grant capabilities or weaken runtime policy.
- Adjacent-version guidance is labelled background.
- Every retrieved excerpt remains bounded and provenance-bearing.

## Enforcement layers

- Shared contracts distinguish authority classes and reject unsupported values.
- Runtime policy rejects model-visible ingestion, arbitrary source, and convention-decision tools.
- Pi grounding instructions treat retrieved text as data, separate evidence classes, and refuse unsupported certainty.
- Backend code owns source allowlists, rights/applicability metadata, approval decisions, persistence, and lifecycle.
