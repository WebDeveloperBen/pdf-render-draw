---
name: red-team-audit
description: Red-team and audit an implementation for bugs, vulnerabilities, edge cases, behavioural regressions, and missing safeguards. Use when Codex needs to inspect frontend, backend, API, data, infra, or full-stack code with a reviewer mindset and return a structured findings list with severity, location, and concrete fixes rather than a summary.
---

# Red Team Audit

Audit the implementation as an adversarial reviewer. Optimise for finding real defects, risky assumptions, and missing protections.

## Workflow

1. Build context from the actual implementation before judging it.
2. Identify the active surfaces: frontend, backend, API contract, data layer, async/concurrency, auth, configuration, and test coverage.
3. Read only the relevant reference files:
   - Use [references/common.md](references/common.md) for every audit.
   - Use [references/frontend.md](references/frontend.md) when UI, browser state, client-side validation, rendering, or interaction logic is involved.
   - Use [references/backend.md](references/backend.md) when server logic, APIs, persistence, jobs, queues, or infra-facing code is involved.
4. Report findings only. Do not pad the response with architecture summaries or compliments.

## Review Standard

- Prefer concrete, user-impacting findings over speculative style comments.
- Challenge silent fallbacks, swallowed errors, and "should never happen" branches.
- Treat missing validation, partial-result handling, and state desynchronisation as first-class risks.
- Check whether behaviour stays correct under empty input, duplicate input, boundary values, retries, races, and stale state.
- Trace data all the way through transformations so IDs, ordering, and ownership are not detached from source records.
- Distinguish between proven defects and plausible risks. If something is uncertain, say what assumption must hold for it to be safe.
- Call out missing tests when they leave an important path or regression unprotected.

## Output Contract

Return a flat, structured list of findings. For each finding include:

- `Category` — concise audit bucket such as Correctness, Security, Edge Case, Performance, API Contract, State Management, Data Integrity, Concurrency, or Testing Gap
- `Severity` — `Critical`, `High`, `Medium`, or `Low`
- `Description` — specific bug or risk and why it matters
- `Location` — function, component, module, endpoint, query, or line reference if available
- `Suggestion` — concrete mitigation or fix

If there are no findings, say that explicitly and mention residual risk areas or testing gaps. Do not summarise the codebase.

## Severity Guidance

- `Critical`: data loss, privilege escalation, auth bypass, unsafe destructive action, severe integrity breach, or production outage risk with a realistic trigger
- `High`: incorrect business behaviour, security exposure, race, crash, broken recovery path, or major regression on a common path
- `Medium`: constrained correctness bug, incomplete validation, misleading UI state, avoidable performance issue, or brittle contract handling
- `Low`: minor bug, weak observability, narrow edge case, or missing defence that is unlikely to fail often

## Audit Tactics

- Start from user-controlled input and follow it to persistence, rendering, external calls, and side effects.
- Compare happy-path assumptions against failure-path behaviour.
- Look for mismatches between local state, server state, cached state, and rendered state.
- Verify ordering, deduplication, pagination, and filtering logic after transformations.
- Check whether timeout, cancellation, retry, and idempotency behaviour is explicit.
- Prefer line references when the code is small enough; otherwise cite the narrowest useful symbol.

## Prompt Patterns

- "Use $red-team-audit to inspect this implementation and return only findings."
- "Use $red-team-audit to review this frontend flow for state, validation, and UX integrity issues."
- "Use $red-team-audit to review this backend feature for contract, persistence, concurrency, and security risks."

