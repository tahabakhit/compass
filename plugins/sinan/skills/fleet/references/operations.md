# Fleet Operations Reference

Load this only after `/fleet` has been selected and the core protocol needs
implementation detail.

## Session File

Create `.planning/fleet/session-{slug}.md` with status, start time, original
direction, a work queue table, per-wave results, discovery relay notes, and
continuation state. Only the coordinator updates this file; agents report in
handoffs.

## Scope And Budget

Before a wave starts, list every agent scope and compare parent/child overlaps.
Read-only scopes do not conflict. Any write overlap must be merged, narrowed, or
sequenced into a later wave. Also check `.planning/coordination/claims/`.

Use `effort`, not hand-tuned token budgets:

| Work type | Effort |
|---|---|
| Research, mapping, audit | `medium` |
| Build, refactor, implement | `high` |
| Verify, typecheck, QA | `low` |

## Timeouts

Read `agentTimeouts.{skill|research|build}` from `harness.json`; defaults are
10, 15, and 30 minutes. On timeout, log `agent-timeout`, extract a partial
handoff if present, retry once with a simplified prompt, then skip. Record
`Status: timed out` in the session file. Never park the whole wave on one hung
agent.

## Shared State

Use append-only writes for discoveries, briefs, telemetry JSONL, and wiki
staging files. Use lock-on-write for `.planning/fleet/session-{slug}.md`,
campaign files, and scope claims. Agents must not write coordinator-owned files
directly.

## Consistency Voting

For irreversible decisions such as completing a partial multi-wave run, merging
after validator failure, or aborting mixed results, spawn three read-only
judgment agents and require a 2/3 majority. Timeouts count as proceed so a
validator failure cannot stall the run indefinitely.

## Coordination Recovery

Instance IDs use `fleet-{session-slug}-{wave}-{agent-index}` and are written to
the worktree, telemetry, and scope claim. After each wave, release claims whose
worktree is gone or whose handoff is missing, then return unfinished scope to
the next queue.

## Speculative Parallel Mode

`/fleet --speculative N [direction]` runs N different approaches against the same
end goal in separate worktrees. Scope overlap is intentional. Compare handoffs,
typecheck results, and tradeoffs, then ask the user to pick a winner. Archive
losing branches; do not delete them.

## Failure Cases

Create `.planning/fleet/` if missing. If all agents in a wave fail, escalate
before continuing. If checkout fails, skip that agent and record the gap. If
discovery compression is missing, write raw handoff excerpts to briefs. If an
agent fails validation or post-wave tests, use `scripts/fleet-steward.js` to mark
the task failed and create a repair task.
