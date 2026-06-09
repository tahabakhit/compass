---
name: fleet
description: >-
  Use when parallel campaign orchestrator. Runs multiple campaigns in
  coordinated waves within a single session. Spawns 2-3 agents per wave in
  isolated worktrees, collects discoveries, shares context between waves. Use
  when work decomposes into 3+ independent streams that can run
  simultaneously.
user-invocable: true
---
# /fleet — Parallel Coordinator

Use for 3+ independent work streams that can run simultaneously in isolated worktrees. Do NOT use for single-file scope, linear work, or when a marshal or skill suffices.

## Orientation

Extended fleet variants should live in [references](references/quick-mode.md) once they outgrow the core protocol.

**Use when:** Running 2+ independent work streams in parallel — tasks with non-overlapping file scopes that can execute simultaneously.

**Don't use when:** Work must execute sequentially or accumulate findings across phases (use `/archon` campaign mode), a single orchestrated session is enough (use `/marshal`), or the task is simple enough for a bare skill.

## Commands

| Command | Behavior |
|---|---|
| `/fleet [direction]` | Decompose direction into parallel streams, execute in waves |
| `/fleet [path-to-spec]` | Read a spec file, decompose into streams |
| `/fleet continue` | Resume from the last fleet session file |
| `/fleet` (no args) | Health diagnostic → work queue → execute |
| `/fleet --quick [task1]; [task2]` | Lightweight parallel mode for solo devs — 2+ tasks, single wave, auto-merge, no session file |
| `/fleet --speculative N [direction]` | Try N different approaches to the same task in parallel — see Speculative Mode below |

## Protocol

### Step 1: WAKE UP

1. Read CLAUDE.md (project conventions)
2. Check `.planning/campaigns/` for active campaigns
3. Check `.planning/coordination/claims/` for external claims
4. Determine input mode: directed, spec-driven, continuing, or undirected
5. **Load prior session context**: If `.planning/momentum.json` exists, run
   ```bash
   node .sinan/scripts/momentum-read.cjs
   ```
   and read the output. Use the active scopes and recurring decisions to inform
   work queue prioritization. Skip silently if the file is absent or output is empty.

> **Wave context restoration:** Use the Claude Code Compaction API to restore fleet
> session context at the start of each session. Do NOT read `.claude/compact-state.json`
> — that pattern is deprecated in favour of server-side compaction (available on Opus 4.6+).
> fleet session files (`.planning/fleet/session-{slug}.md`) remain the source of truth
> for inter-wave discovery relay; compaction handles agent memory, not campaign state.
> If the Compaction API is unavailable, fall back to reading the fleet session file's
> Continuation State directly.

### Step 1b: LOG SESSION START + START WATCHER

```bash
node .sinan/scripts/telemetry-log.cjs --event campaign-start --agent fleet --session {session-slug}
node .sinan/scripts/momentum-watch-start.cjs
```

The watcher runs in the background and re-synthesizes `momentum.json` within 500ms of any new discovery write. Safe to call if already running — only one watcher runs per project.

### Step 2: WORK QUEUE

Produce a ranked list of campaigns with:

| Column | Purpose |
|---|---|
| Campaign name | What this stream does |
| Scope | Which directories it touches |
| Dependencies | What must complete before this can start |
| Wave | Which wave to assign it to |
| Agent type | What kind of agent to spawn |

**Rules for work queue:**
- Independent items go in Wave 1
- Items that depend on Wave 1 results go in Wave 2
- Maximum 3 agents per wave (conservative default)
- Scope must NOT overlap between agents in the same wave
- After writing or changing a session queue, run
  `node scripts/fleet-steward.js --session .planning/fleet/session-{slug}.md`
  and use its `READY TO RUN`, `BLOCKED`, `MERGE NEXT`, `MERGE BLOCKED`, and
  `SCOPE CONFLICTS` sections as the operational DAG.
- If the steward reports `READINESS BLOCKED`, do not spawn that task in a
  high-autonomy wave unless a human verified the worktree and you pass
  `--override-readiness` intentionally.

### Step 3: WAVE EXECUTION

For each wave:

1. **Prepare context** for each agent:
   - CLAUDE.md content
   - `.claude/agent-context/rules-summary.md`
   - **Map slice** (if `.planning/map/index.json` exists): run
     `node scripts/map-index.js --slice "<agent's scope keywords>" --max-files 15`
     and inject the generated `=== MAP SLICE ===` block. If the index does
     not exist, skip silently.
   - **Prior session context** (all waves): re-read `momentum.json` fresh at each
     wave boundary via `node .sinan/scripts/momentum-read.cjs` and inject as a
     `=== PRIOR SESSION CONTEXT ===` block. Re-reading (rather than reusing the
     Step 1 snapshot) picks up discoveries written by parallel fleet sessions in
     other terminals. If the output is empty, skip silently.
   - Campaign-specific direction and scope
   - Discovery briefs from previous waves (if any)
   - Sandbox provider status when an agent has a known worktree:
     `node scripts/sandbox-provider.js status --provider worktree --worktree {path}`

2. **Log wave start**:
   ```bash
   node .sinan/scripts/telemetry-log.cjs --event wave-start --agent fleet --session {session-slug} --meta '{"wave":N,"agents":["name1","name2"]}'
   ```

3. **Spawn agents** with `isolation: "worktree"`:
   ```
   Agent(
     prompt: "{full context + direction}",
     isolation: "worktree",
     mode: "bypassPermissions"
   )
   ```

4. **Collect results** from all agents in the wave

4.5. **Validate wave results** — spawn one Phase Validator per agent in parallel
   (validators are Haiku, read-only, effort: low):
   ```
   Agent(
     subagent_type: "sinan:phase-validator",
     prompt: "Campaign: {session-slug}. Wave {N} agent: {agent-name}.
              Exit conditions: {agent's scope goal and any stated conditions}.
              HANDOFF: {agent's full handoff text}",
     effort: "low"
   )
   ```
   Collect all validator verdicts. For each agent:
   - **`verdict: "pass"`**: mark agent `validated` in session file. Proceed.
   - **`verdict: "fail"`**: check retry counter for this agent (max 2 retries in fleet;
     single-session so lower budget than `/archon` campaign mode's 3):
     - **Retries remain**: re-spawn the failed agent in a new worktree with the
       validator's `conditions_failed` and `suggestions` appended to its prompt.
       Collect its result and re-validate. Decrement counter.
     - **Retries exhausted**: mark agent `partial` in session file. Log
       `validator_halt: {agent-name} wave {N} — {conditions_failed}`. Continue.
   - **Validator timeout or unparseable output**: treat as pass with warning. Log. Advance.

   Run all validators for the wave in a single parallel batch — do not validate
   sequentially. The cost is proportional to the wave size, not multiplicative.

4.75. **Validate task exit evidence** if the fleet session file has an
   `## Exit Evidence` table:
   ```bash
   node scripts/evidence-validate.js --file .planning/fleet/session-{slug}.md --target task:{id}
   ```
   Failed required evidence creates a repair task or blocks advancement based on
   its retries remaining.

5. **Log per-agent results**:
   ```bash
   node .sinan/scripts/telemetry-log.cjs --event agent-complete --agent {agent-name} --session {session-slug} --status {success|partial|failed}
   ```

6. **Compress discoveries** for each agent:
   - Extract HANDOFF blocks
   - Run `node .sinan/scripts/compress-discovery.cjs` on each output
   - Write compressed briefs to `.planning/fleet/briefs/`

6b. **Write persistent discovery records** for each agent (cross-session memory):
   ```bash
   node .sinan/scripts/discovery-write.cjs \
     --session {session-slug} \
     --agent {agent-name} \
     --wave {wave-number} \
     --status {success|partial|failed} \
     --scope "{comma-separated-scope-dirs}" \
     --handoff "{json-array-of-handoff-items}" \
     --decisions "{json-array-of-decisions}" \
     --files "{json-array-of-files-touched}" \
     --failures "{json-array-of-failures}"
   ```

7. **Log wave complete**:
   ```bash
   node .sinan/scripts/telemetry-log.cjs --event wave-complete --agent fleet --session {session-slug} --meta '{"wave":N,"status":"complete"}'
   ```

8. **Merge branches** from worktrees:
   - Run `node scripts/fleet-steward.js --session .planning/fleet/session-{slug}.md`
   - Merge only tasks listed under `MERGE NEXT`
   - Review changes from each agent
   - If clean merge: merge the branch
   - If conflicts: record in session file, then decide:
     - **Resolve if:** the conflict is < 20 lines and affects only formatting or naming
     - **Skip if:** the conflict involves competing logic changes; keep the higher-delta worktree result and log the discarded changes in session file

9. **Update session file** with wave results and accumulated discoveries

### Step 5: COMPLETION

After all waves:

1. Run typecheck on the full project via `node scripts/run-with-timeout.js 300 <typecheck-cmd>`
2. Run tests if configured (also use the timeout wrapper). If tests fail after wave completion: apply the same error ladder as the main protocol — 1-2 failures: fix before merging; 3-4 failures: attempt fixes, continue if resolved; 5+ failures: halt the wave merge for that worktree and log `wave_test_fail: true` in the session file.
3. Update session file status to `completed`
4. Log session completion:
   ```bash
   node .sinan/scripts/telemetry-log.cjs --event campaign-complete --agent fleet --session {session-slug}
   ```
5. **Update momentum** (cross-session synthesis):
   ```bash
   node .sinan/scripts/momentum-synthesize.cjs
   ```
5.5. **Propagate knowledge** — for each campaign that completed this session, run:
   ```bash
   npm run propagate -- --campaign {slug}
   ```
   Run once per completed campaign slug (not per wave). If multiple campaigns
   completed, run for each slug. If `npm run propagate` is unavailable, note each
   slug in the fleet session file under `## Pending Propagation`.
6. Output final HANDOFF

## Progressive References

Load [operations](references/operations.md) only when you need the session file
template, scope-overlap examples, effort hints, timeout defaults, shared-state
merge strategies, consistency voting, coordination recovery, or speculative
parallel mode details.

## Quality Gates

- All agents must receive full context injection
- Scope must not overlap between same-wave agents
- Every wave must produce compressed discovery briefs
- Discovery relay must be injected into subsequent waves
- Merge conflicts must be resolved or explicitly recorded
- Final typecheck must pass after all waves

## Quick Mode

For lightweight two-or-more stream execution, use [Quick Mode](references/quick-mode.md).

## Fringe Cases

Load [operations](references/operations.md) for missing `.planning/`, checkout
failures, failed waves, missing discovery compression, validator timeouts, and
repair-task handling. Never let one hung or malformed agent response block the
entire parallel run.

## Contextual Gates

### Disclosure
- "Spawning {N} agents across {waves} waves in isolated worktrees. Estimated token budget: ~{tokens}K."
- For speculative mode: "Running {N} parallel approaches to the same task. All will touch the same files."

### Reversibility
- **Green:** Single-wave fleet with < 3 agents
- **Amber:** Multi-wave fleet (the default) -- each wave's merge is a separate commit
- **Red:** Speculative mode or fleets that modify shared infrastructure

Red actions require explicit confirmation regardless of trust level.

### Proportionality
- **Standard fleet:** work queue requires 3+ independent streams. Fewer -> downgrade to `/marshal` session mode or `/archon` campaign mode.
- **Quick mode:** 2+ tasks with non-overlapping scopes. No minimum complexity gate.
- If all streams touch the same directory: downgrade to sequential campaign phases
- If estimated agents > 6: confirm with user (even trusted level)

### Trust Gating
Read trust level from `harness.json`:
- **Novice** (0-4 sessions): Always confirm before spawning. Show agent count, scopes, and estimated cost.
- **Familiar** (5-19 sessions): Confirm only for > 3 agents or speculative mode.
- **Trusted** (20+ sessions): Auto-proceed for standard fleet. Confirm only for speculative mode or > 6 agents.

## Exit Protocol

Update the session file, then output:

```
---HANDOFF---
- fleet session: {name} — {waves completed} waves, {agents} agents total
- Built: {summary of all wave results}
- Discoveries: {key cross-agent findings}
- Merge conflicts: {count and resolution}
- Next: {remaining work if any}
- Reversibility: amber -- multi-wave merges, revert each wave's merge commit
---
```
