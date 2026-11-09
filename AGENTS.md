# Simon project instructions

## Product

Simon is a local, Pi-powered engineering assistant application. The current implementation slice is only the reusable chat UI and assistant runtime described in `docs/PLAN.md`.

TIA Portal, Siemens Openness, Fanqi, MCP, PLC reads/writes, shell access, and filesystem mutation are outside the current application scope.

## Current architecture

- `app/web` — React/TypeScript browser application.
- `app/server` — local Fastify/TypeScript backend and future Pi host.
- `packages/contracts` — shared API and event schemas.
- `references` — product, architecture, coding, workflow, and AI behavior guidance.
- `docs` — consolidated handoffs, implementation plan, roadmap, and decisions.
- `data` — local runtime data; generated contents must remain untracked.

The intended browser/backend transport is HTTP for commands and SSE for events. Pi is integrated server-side through an application-owned adapter. Browser code must not receive provider credentials.

## Authoritative documents

Read progressively:

1. `docs/PLAN.md` — active implementation scope and phases.
2. `references/product-brief.md` — product outcome and non-goals.
3. `references/architecture-decisions.md` — accepted technical choices.
4. `references/user-flows.md` — expected user behavior.
5. `references/coding-standards.md` — implementation conventions.
6. `references/ai-behavior.md` — behavior of the in-app assistant.
7. `docs/AI_ASSISTANT_MCP_HANDOFF.md` — source interaction pattern and known defects to avoid.
8. `docs/Simon_v0_3.md` — broader future product direction; do not implement its TIA scope yet.

## Workflow

- Work in small verified steps following `docs/PLAN.md`.
- State assumptions when requirements are not established.
- Keep browser, application orchestration, Pi adapter, and future domain tools separate.
- Add or update tests with behavior changes.
- Run `npm run typecheck` and relevant tests before reporting completion.
- Review `git diff` and avoid unrelated changes.
- Record durable architecture decisions in `docs/DECISIONS.md` and the concise ADR catalogue in `references/architecture-decisions.md`.

## Frontend design standard

- For every task that creates, changes, reviews, or polishes Simon's frontend, invoke and follow the `frontend-design` skill before implementation.
- The canonical local skill is `C:/Users/aiagent/.agents/skills/frontend-design/SKILL.md` (equivalent command: `/skill:frontend-design`).
- Treat this as the default design standard, not an optional enhancement or a requirement that must be repeated by the user.
- Maintain a deliberate, premium, cohesive visual direction and avoid generic AI-generated interface patterns.
- Preserve Simon's established industrial/refined design language and the approved Todai-derived composer unless the user explicitly requests a redesign.
- Design changes must remain accessible, responsive, keyboard-operable, and consistent with existing functional behavior.

## Safety and privacy

- Never commit secrets, credentials, sessions, customer data, TIA exports, or proprietary Siemens files.
- Do not expose arbitrary shell, filesystem, MCP, or external mutation tools to the in-app assistant.
- Treat model output, conversation content, retrieved content, Markdown, and links as untrusted.
- Bind the local server to loopback by default.
- Keep approval and execution policy in backend code, not prompts or UI labels.
- Never represent a proposed, simulated, or synthetic action as completed external work.

## Coding rules

- Use strict TypeScript and shared schemas at process boundaries.
- Prefer small focused modules and explicit state transitions.
- Avoid `any`; validate external data at runtime.
- Use stable IDs for conversations, runs, events, tool calls, and proposals.
- Map Pi events into Simon-owned contracts instead of exposing Pi internals directly to the browser.
- Do not invent activity states. UI progress must correspond to real backend/runtime events.
- Preserve accessibility, keyboard operation, reduced motion, and mobile behavior.

## Git

Do not commit or push unless explicitly requested. Never rewrite shared history or use destructive Git operations without approval.
