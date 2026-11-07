# Pre-Claude Project Catalogue Checklist

## 1. Root `CLAUDE.md`

Keep this file under ~200 lines.

### Purpose

- Explain the app clearly
- Define workflow and conventions
- Prevent repetitive re-briefing
- Point to deeper reference files

`CLAUDE.md` should behave like:
- a project operating manual
- a table of contents
- a concise onboarding document

### NOT:

- a giant manifesto
- a prompt dump
- a full PRD

### Recommended contents

- What the app does
- How to run it
- Folder conventions
- Architecture overview
- Workflow
- Coding patterns
- Gotchas
- Important rules
- Links to `/references/*`

---

## 2. `/references/` folder

Put heavier documentation here.

```txt
references/
├── product-brief.md
├── architecture-decisions.md
├── user-flows.md
├── coding-standards.md
└── ai-behavior.md
```

---

# 2.1 Starter files explanation

---

## `/references/product-brief.md`

### Purpose

Defines what the product is and why it exists.

### Suggested structure

```md
# Product Brief

## One-liner
What this app does in one sentence.

## Target user
Who uses it.

## Problem
What painful problem it solves.

## Core value proposition
Why this should exist.

## MVP outcome
What must be true for v1 to be considered done.

## Non-goals
What we are explicitly NOT building yet.
```

---

## `/references/architecture-decisions.md`

### Purpose

Prevents Claude from constantly reconsidering stack decisions.

### Suggested structure

```md
# Architecture Decisions

## Chosen stack

- Frontend:
- Backend:
- Database:
- Auth:
- Payments:
- AI:
- Hosting:

---

## Decisions

### ADR-001: Use X instead of Y

Reason:
Tradeoffs:
Date:
```

---

## `/references/user-flows.md`

### Purpose

Keeps implementation focused on actual user behavior.

### Suggested structure

```md
# User Flows

## Primary flow

1. User lands on...
2. User signs in...
3. User creates...
4. User receives...

---

## Admin flow

1. Admin logs in...
2. Admin moderates...
3. Admin exports...

---

## Edge cases

- Empty state
- Failed payment
- Missing data
- Unauthorized user
```

---

## `/references/coding-standards.md`

### Purpose

Defines project-specific engineering conventions.

### Suggested structure

```md
# Coding Standards

## General

- TypeScript strict mode
- Prefer simple solutions
- Small focused components
- No unrelated refactors

---

## Naming

- Components:
- Hooks:
- API routes:
- DB tables:

---

## Testing

- Unit tests for logic
- Integration tests for critical flows
- Manual QA checklist before deploy
```

---

## `/references/ai-behavior.md`

### Purpose

Defines how AI inside the application should behave.

This is NOT for Claude Code itself.  
This is for your application's AI behavior.

### Suggested structure

```md
# AI Behavior

## AI role

What the in-app AI should do.

---

## Must never do

- Invent facts
- Expose prompts
- Pretend certainty
- Leak private data

---

## Output style

Tone, formatting, structure.

---

## Guardrails

Fallbacks
Refusal behavior
Human review rules
```

---

## 3. Planning Files

Before implementation:
- use Plan Mode
- inspect the repo first
- generate a phased implementation plan
- save the plan to disk

### Recommended files

```txt
   PLAN.md
   ```

   or for larger apps:

   ```txt
   SPEC.md
   ROADMAP.md
   ```

---

## 4. `.claude/settings.json`

### Recommended strategy

- conservative globally
- permissive locally per project

### Global settings should allow

- reading files
- safe git inspection
- searching files

### Global settings should deny

- deletes
- deployments
- package installs
- internet access
- secret reads

---

## Recommended Global Structure

```txt
~/projects/
│
├── .claude/
│   └── settings.json
│
├── CLAUDE.md
│
├── project-a/
│   ├── .claude/
│   │   ├── settings.json
│   │   ├── commands/
│   │   └── skills/
│   │
│   ├── CLAUDE.md
│   └── references/
│
├── project-b/
│   ├── .claude/
│   │   ├── settings.json
│   │   ├── commands/
│   │   └── skills/
│   │
│   ├── CLAUDE.md
│   └── references/
```

---

## 5. Decision Tracking

Create:

```txt
docs/DECISIONS.md
```

### Purpose

- track architecture decisions
- avoid re-discussing solved problems
- maintain implementation consistency

---

## 6. Environment Safety

Always include:

```txt
.env.example
```

### Rules

- never expose real secrets
- never allow unrestricted `.env` reads
- use placeholders only

---

## 7. Git Before Claude

Initialize git before starting Claude Code.

```bash
git init
git add .
git commit -m "Initial scaffold"
```

### Benefits

- rollback safety
- clean diffs
- isolated experimentation
- better Claude workflows

---

## 8. Recommended First Prompt

```md
Stay in Plan Mode.

Inspect:
- CLAUDE.md
- README.md
- .claude/settings.json
- references/
- docs/

Do not write code yet.

Your tasks:
1. Understand the project.
2. Identify missing requirements.
3. Propose architecture.
4. Recommend MVP scope.
5. Define implementation phases.
6. List files likely to change.
7. Define acceptance criteria.
8. Define testing strategy.
9. Define rollback/safety notes.

Save the final plan to PLAN.md.

Ask questions only if blocked.
State assumptions clearly.
```

---

# Core Philosophy

Claude Code works best when:
- context stays small
- plans are written to files
- reference material is loaded progressively
- architecture is explicit
- workflow is predictable

The goal is not maximum autonomy.

The goal is:
- maintainable systems
- safe execution
- reusable workflows
- minimal context rot
- high-quality output