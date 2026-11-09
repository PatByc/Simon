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
