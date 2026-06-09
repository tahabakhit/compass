# archon Progressive Disclosure

Use this reference for bulky operational variants, examples, and edge-case details that should stay out of always-read skill orientation.

## Phase And Effort Tables

Common phase types:

| Phase | Purpose | Typical route |
|---|---|---|
| research | Understand before building | `/marshal` assess mode |
| plan | Make architecture decisions | `/marshal` plus review |
| build | Write code | `/marshal` or sub-agent |
| wire | Connect systems | `/marshal` with specific targets |
| verify | Confirm behavior | typecheck, tests, review |
| prune | Remove dead code | `/marshal` with removal targets |

Use `effort` instead of token budgets: audit and verify are `low`, refactor and
design are `medium`, build is `high`.

## Self-Correction

Direction alignment: every two phases, compare the original direction to the
feature ledger. If drifted, log the drift and either adjust remaining phases or
park.

Quality spot-check: every phase, inspect the most important output for types,
structure, project conventions, and visual behavior when UI files changed.

Regression guard: on build phases, run typecheck via
`node scripts/run-with-timeout.js 300`; fix 1-2 new errors, attempt 3-4, and
park on 5+ or test regressions.

Anti-pattern scan: on build phases, scan modified files for broad transitions,
browser dialogs, missing Escape handlers, and hardcoded values that should be
constants.

## Undirected Health Diagnostic

Check intake, active campaigns, recently completed campaigns, typecheck drift,
and completed campaign count. Suggest the smallest next action rather than
starting a campaign without direction.

## Circuit Breakers And Recovery

Park on three consecutive failures on the same approach, fundamental
architecture conflict, repeated quality failures, repeated direction drift, 5+
new type errors, or test regressions. Recover by popping the phase checkpoint
from Continuation State, rerunning typecheck, and logging the rollback.

## Fringe Cases

No active campaign plus no direction runs the health diagnostic. Corrupted
campaign files are skipped with a report. Missing `.planning/campaigns/` means
no active campaigns. Missing handoff marks a phase partial. Hung sub-agents
timeout after 30 minutes and trigger recovery. Malformed validator output is a
warning, not a blocker; exhausting retries marks the phase partial.

## Policy Gate

For Red operations, spawn the policy-enforcer with action, Tier 1 rules
(`P-001`, `P-002`, `P-004`, `P-007`), campaign slug, and session ID. `allow`
proceeds. `block` is logged and stops the operation.
