# Coding Standards

## General

- Use strict TypeScript.
- Prefer the simplest implementation that satisfies the active phase.
- Keep components and modules focused.
- Avoid unrelated refactors and speculative abstractions.
- Add comments for constraints and non-obvious decisions, not line-by-line narration.

## Boundaries

- Validate all HTTP, storage, provider, and event payloads at runtime.
- Shared contracts belong in `packages/contracts`.
- Browser code must not import backend or Pi implementation modules.
- Pi-specific types stay inside the adapter unless intentionally translated.
- Application policy belongs in backend/core modules, not React components or prompts.

## TypeScript

- Avoid `any`; prefer `unknown` plus validation.
- Use discriminated unions for lifecycle and result states.
- Handle optional values explicitly under `exactOptionalPropertyTypes`.
- Use exhaustive switches for state machines and event variants.
- Prefer immutable inputs and explicit return values.

## Naming

- React components: `PascalCase`.
- Hooks: `useCamelCase`.
- Functions and variables: `camelCase`.
- Types and schemas: `PascalCase` with descriptive suffixes where useful.
- API paths: plural nouns and stable versioning.
- Events: dot-separated domain names such as `run.started`.
- Database tables/columns: `snake_case`.

## UI

- Preserve semantic HTML and accessible names.
- Support keyboard operation, focus restoration, mobile layouts, and reduced motion.
- Never use arbitrary assistant HTML.
- Sanitize Markdown and validate links.
- Derive progress only from actual events.

## Backend

- Bind to loopback by default.
- Return stable error codes and correlation IDs.
- Do not expose raw provider errors or secrets.
- Make state transitions explicit and idempotent where possible.
- Separate accepted commands from completed runtime work.

## Testing

- Unit-test state machines, parsing, policy, and event mapping.
- Contract-test HTTP and SSE behavior.
- Component-test accessibility and interaction states.
- End-to-end test the primary user flows.
- Run `npm run typecheck` and relevant tests before completion.
