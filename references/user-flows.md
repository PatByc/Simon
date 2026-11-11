# User Flows

## Start a conversation

1. User opens the Simon drawer from any page.
2. Focus moves to the composer.
3. User submits a message.
4. The UI creates a run and connects to its event stream.
5. Simon displays actual runtime activity and streamed assistant text.
6. The run reaches a clear completed, aborted, or failed state.
7. Focus returns to the composer.

## Pin the assistant

1. User opens the overlay drawer.
2. User selects Pin.
3. The drawer becomes a complementary region beside the page.
4. Main content reserves space instead of being covered.
5. Navigation does not destroy the conversation.
6. On a narrow screen, the drawer returns to full-width behavior.

## Stop a response

1. User submits a prompt.
2. While Pi is active, the composer exposes Stop.
3. User stops the run.
4. Backend aborts the active Pi operation.
5. UI marks the run aborted; it does not claim completion or rollback external work.

## Resume a conversation

1. User opens conversation history.
2. User selects a prior conversation.
3. Backend opens the associated Pi session.
4. Transcript and current metadata are restored.
5. A new prompt continues that conversation.

## Use a slash command

1. User types `/` or opens the command palette.
2. Commands are ranked and described.
3. Host commands execute deterministic application behavior.
4. Unknown commands are explained rather than sent to a shell.

## Attach read-only engineering context

1. User opens the engineering context panel in `tia-readonly` mode.
2. Simon discovers TIA processes without attaching.
3. User explicitly selects one process with an open project.
4. Backend attaches through the host-only lifecycle path and binds the conversation to the observed project identity and connection epoch.
5. UI shows read-only state, binding identity, observation time, inventory scope, and coverage limitations.
6. Pi may use only classified read tools after the binding guard succeeds.
7. Disconnect releases Simon's attachment without closing TIA Portal or its project.

## Create and search an engineering snapshot

1. User explicitly requests snapshot creation or refresh from the engineering panel.
2. Backend collects bounded read-only evidence through host-controlled operations.
3. UI shows lifecycle state, freshness, counts, and complete/partial/failed coverage.
4. User searches by engineering path, exact name, tag, logical address, or lexical phrase.
5. Results return bounded snippets and engineering-path citations.
6. Duplicate names require engineering-path disambiguation.
7. Pi checks snapshot status and uses only status/search/reference retrieval tools for snapshot-grounded claims.
8. Detach, restart, target mismatch, or binding epoch change makes affected snapshots stale and blocks retrieval until reconnect and refresh.

## Search version-aware documentation

1. User opens documentation evidence in settings.
2. Backend reports installed and official-online source state independently.
3. User sets or accepts a product/version/update/CPU/firmware/language/locale target and searches.
4. Exact topic keys, titles, aliases, and instruction names are resolved before bounded lexical search.
5. Results show source identity, stable citation, indexed time, applicability state/reasons, rights label, and bounded evidence.
6. Conflicting exact topics require disambiguation; adjacent-version material appears only when explicitly allowed and remains background.
7. Pi checks documentation status and uses only status/search tools. It cannot ingest, refresh, crawl, choose arbitrary URLs/files, or reinterpret retrieved text as instructions.

## Infer and approve a local convention

1. Host code supplies explicitly authorized observed-project examples.
2. Deterministic inference creates an inactive draft with representative evidence, confidence, and explicit exceptions.
3. An engineer approves or rejects through a host-controlled decision path; Pi cannot decide.
4. Approval creates immutable revision 1. Later edits append superseding revisions and retirement appends a retired revision.
5. Pi can count and search only active approved revisions and cites revision ID plus project evidence.
6. Rejected, superseded, and retired revisions remain auditable but do not guide the assistant.
7. Deterministic checks may report structural findings only; they never claim compilation, runtime correctness, or functional verification.

## Review a synthetic proposal

1. User invokes `/demo-review`.
2. Backend creates a clearly labeled synthetic proposal with immutable content.
3. In Manual mode, the proposal waits for Approve, Revise, or Reject.
4. In Auto mode, only backend-classified demo/local actions may proceed.
5. Duplicate, expired, or altered decisions are rejected.
6. UI never represents the demonstration as a TIA or external-system change.

## Reconnect after a network interruption

1. Browser records the last `run_id` and sequence.
2. SSE reconnects with the last observed sequence.
3. Backend replays missing in-memory events.
4. Client deduplicates by `run_id + sequence`.
5. A missing terminal state is shown as interrupted/unknown, never successful.

## Edge cases

- Pi or provider unavailable.
- No configured model or credential.
- Browser refresh during a run.
- Backend restart during a run.
- Duplicate event delivery.
- Unsupported slash command.
- Conversation session missing or corrupt.
- Unsafe Markdown link.
- Mobile viewport and on-screen keyboard.
- Reduced-motion preference.
