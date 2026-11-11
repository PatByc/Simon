# Simon Roadmap

## Completed — Chat, Pi, and M1 attachment foundation

- Full-window React chat and Fastify/SSE backend.
- Persistent Pi conversations, branches, recovery, model controls, and activity traces.
- Synthetic knowledge and proposal demonstrations.
- Simon-owned engineering MCP package and incorporated TIA Portal V20 worker.
- Explicit read-only TIA process discovery and selection.
- Conversation-scoped project bindings with process-start identity and binding epochs.
- Bounded project inventory, capability reporting, diagnostics, and guarded Pi tools.
- Application-level live qualification of attach, project inventory, Pi read, detach, and reconnect-required restart behavior.

Manual browser qualification remains tracked in `docs/MANUAL_QA.md` and `docs/M1_CHECKLIST.md`.

## Now — M2 source extraction and retrieval

- Qualify representative block, type, interface, tag, reference, and hardware reads.
- Add explicit PLC tag-table/tag enumeration and counting.
- Build project snapshots with binding, freshness, coverage, and provenance.
- Add exact and lexical project retrieval with source-linked answers.
- Add bounded SCL and supported FBD/LAD reading without enabling writes.
- Investigate incomplete nested hardware visibility and report unsupported coverage.

## Next — Documentation and conventions

- Discover version-correct Siemens documentation sources.
- Add sourced instruction retrieval.
- Infer project conventions from authorized examples and require approval.
- Keep documented, inferred, and approved guidance distinct.

## Later — Controlled engineering changes

- No-change export/import round trips on a disposable project.
- Recovery evidence for transaction and post-commit compile failures.
- One exact reviewed non-safety SCL change.
- Durable operation journal and restart reconciliation.
- Qualified graphical edit classes only after preservation tests.

## Future — Bounded customization

- Reversible local configuration changes.
- Small read-only panels.
- Isolated executable customization only after separate security gates.
- Optional reviewed and sanitized upstream contributions.

No later phase is authorized merely by completing M1. Writes remain disabled until M4 evidence and the independent approval design are complete.
