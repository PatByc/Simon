# Simon Chat Application Specification

## Status

Initial specification for the chat UI and Pi assistant foundation. Detailed delivery phases are in `PLAN.md`.

## Required capabilities

- Global assistant drawer available across routes.
- Overlay, pinned, mobile, keyboard, and reduced-motion behavior.
- Backend-owned Pi conversations and credentials.
- Streamed assistant text and truthful lifecycle events.
- Conversation create, resume, rename, stop, and delete operations.
- Model and thinking-level selection from real Pi capabilities.
- Host-owned slash commands.
- Manual/Auto preference with backend-enforced scope.
- Synthetic proposal review with immutable content and explicit states.
- Local persistence, reconnect handling, and non-replaying restart behavior.

## Quality requirements

- Strict TypeScript and runtime validation at boundaries.
- Accessible semantic UI.
- Safe Markdown and link handling.
- Loopback-only default server binding.
- No browser-visible provider secrets.
- No fabricated activity or completion status.
- Automated unit, integration, component, and end-to-end tests.

## Current exclusions

TIA Portal, Siemens Openness, Fanqi, MCP, PLC projects, shell access, filesystem mutation, cloud deployment, multi-user authentication, and executable plugins.

## Acceptance

The slice is complete when a local user can reliably converse through Pi, manage and resume sessions, inspect actual runtime activity, operate the drawer and commands accessibly, and exercise a clearly synthetic review flow without any unavailable engineering capability being implied.
