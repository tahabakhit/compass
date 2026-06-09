---
name: daemon
description: >-
  Use when continuous autonomous operation mode. Keeps campaigns running 24/7
  by chaining Claude Code sessions via RemoteTrigger. Each session picks up
  from the campaign's continuation state, works until context runs low or the
  phase completes, then schedules the next session. Auto-stops on campaign
  completion or budget exhaustion. The continuous runner for overnight work.
user-invocable: true
---
# /daemon -- Continuous Autonomous Operation

## Orientation

Operational variants and bulky edge-case detail should live in [progressive disclosure](references/progressive-disclosure.md).

**Use when:** running campaigns overnight or unattended -- chains sessions automatically until a ceiling or budget is hit.
**Don't use when:** a single autonomous session is enough (use /archon); you want manual control between cycles (use /loop).

## Default execution path (READ FIRST)

**`/daemon start` does NOT call `RemoteTrigger` by default.** The local
runner is the default. Only pass `--remote` to use Anthropic's routine
system, and only after explicit user confirmation.

Load [progressive disclosure](references/progressive-disclosure.md) for local
runner output, Codex automation setup, remote routine quota detail, and
confirmation text.

## Commands

| Command | Behavior |
|---|---|
| `/daemon start` | Default: create state file, prompt user to run `npm run daemon:local` (zero routine cost) |
| `/daemon start --remote` | Use `RemoteTrigger` instead (counts against 15/day routine quota — requires confirmation) |
| `/daemon start --campaign {slug}` | Target a specific campaign |
| `/daemon start --budget {N}` | Set budget cap in dollars (default: $50) |
| `/daemon start --budget unlimited` | Explicitly disable budget cap |
| `/daemon start --interval {N}m` | Set watchdog interval (default: 30m) |
| `/daemon start --cooldown {N}s` | Set delay between sessions (default: 60s) |
| `/daemon start --cost-per-session {N}` | Override per-session cost estimate (default: $3) |
| `/daemon stop` | Stop the daemon, tear down triggers |
| `/daemon status` | Show daemon state, session count, budget remaining |
| `/daemon log` | Show recent daemon session history |
| `/daemon tick` | Internal: heartbeat handler fired by triggers. Not user-facing. |

## Protocol

### /daemon start

**Step 1: Validate prerequisites**

1. Check `.planning/` exists. If not: "No planning directory found. Run `/do setup` first."
2. Find the target campaign:
   - If `--campaign {slug}` provided: read `.planning/campaigns/{slug}.md`
   - Otherwise: scan `.planning/campaigns/` (excluding `completed/`) for files with
     `status: active` in frontmatter
   - If no active campaign found: "No active campaign. Start one with `/archon` first."
   - If multiple active campaigns and no `--campaign` flag: list them, ask user to specify
3. Verify the campaign has a Continuation State section (`/archon` campaign mode knows where to resume)
4. Parse budget:
   - Default: `$50`
   - If `--budget unlimited`: set budget to `Infinity`, warn: "No budget cap. You will not
     be protected from runaway costs. Monitor usage at your Anthropic dashboard."
   - If `--budget {N}`: parse as number, must be > 0
5. Parse cost-per-session:
   - If `--cost-per-session {N}` provided: use that value
   - If not provided AND the campaign has an `estimated_cost_per_loop` field in frontmatter
     (improve campaigns set this to 12): use that value
   - Otherwise: default `$3`
   - This auto-read prevents the common mistake of running an improve campaign
     (which spawns 3 evaluator agents + attack + verify per loop) with the $3
     default designed for simple campaign sessions

**Step 2: Check for existing daemon**

1. Read `.planning/daemon.json` if it exists
2. If a daemon is already running (`status: "running"`):
   - Show its state: campaign, sessions completed, budget remaining
   - Ask: "A daemon is already running. Stop it and start a new one?"
   - If yes: run `/daemon stop` first, then continue
   - If no: abort

**Step 3: Create triggers**

**A. Chain trigger** — one-shot, fires after cooldown, `command: "/daemon tick"`. Save ID as `chainTriggerId`.

**B. Watchdog trigger** — recurring, fires every `--interval`, `command: "/daemon tick --watchdog"`. Save ID as `watchdogTriggerId`.

Both use `type: scheduled/recurring`, `project_path: {absolute project root}`, `description: "Daemon: {slug} tick/watchdog"`.

**Step 4: Write state file**

Write `.planning/daemon.json`:

```json
{
  "status": "running",
  "campaignSlug": "{slug}",
  "budget": 50,
  "costPerSession": 3,
  "estimatedSpend": 0,
  "sessionCount": 0,
  "interval": "30m",
  "cooldown": "60s",
  "chainTriggerId": "{id from step 3A}",
  "watchdogTriggerId": "{id from step 3B}",
  "startedAt": "{ISO timestamp}",
  "lastTickAt": null,
  "lastTickStatus": null,
  "stoppedAt": null,
  "stopReason": null,
  "log": []
}
```

**Step 5: Log and confirm**

Log: `daemon-start` event with budget and interval. Output confirmation: campaign slug, budget (estimated sessions), cooldown, watchdog interval, state file path. Suggest `/daemon status` and `/daemon stop`.

---

### /daemon stop

1. Read `.planning/daemon.json`. If missing or not `running`: "No daemon is running."
2. Delete both triggers (ignore failures — may already be cleaned up).
3. Update daemon.json: `status: stopped`, `stoppedAt`, `stopReason: user`.
4. Log `daemon-stop` event. Output: sessions completed, estimated spend, campaign status.

---

### /daemon status

Output: status, campaign (slug + phase), sessions, budget (spent/cap/remaining), cost/session source, last tick (time + status), running duration, watchdog interval, state file path.

If `paused-level-up`: add instructions to review proposals at `.planning/rubrics/{target}-proposals.md` and set campaign `status: active` to resume.

For improve campaigns: add loops completed/total, current level, last axis attacked.

---

### /daemon log

1. Read `.planning/daemon.json`
2. Output the `log` array, most recent first, formatted as:
   ```
   [{timestamp}] Session #{N}: {status} -- {summary}
     Phase: {phase} | Duration: {duration} | Est. cost: ${cost}
   ```
3. Show the last 20 entries. If more exist: "Showing last 20 of {total}. Full log in .planning/daemon.json"

---

### /daemon tick

Internal heartbeat. Read `.planning/daemon.json`, enforce status/lock/budget
gates, read the campaign file, run `/do continue`, record the session, compile
memory if planning changed, and schedule the next tick only when budget and
campaign state still allow it. Load [progressive disclosure](references/progressive-disclosure.md)
for gate-by-gate details.

---

### /daemon tick --watchdog

Same as `/daemon tick`, plus a chain-health check. If the last tick is older
than `2 * interval` and no run is active, the watchdog becomes the chain tick.
Load [progressive disclosure](references/progressive-disclosure.md) for hook
bridge, budget tracking, and fringe cases.

---

## Contextual Gates

### Disclosure
Always disclose, regardless of trust level:
- "Starting continuous mode on campaign {slug}. Budget: ${N} (~{sessions} sessions at ${cost}/session). Sessions restart automatically until done or budget exhausted."
- For unlimited budget: "WARNING: No budget cap. Sessions will continue until the campaign completes or you run `/daemon stop`."

### Reversibility
- **Amber:** Standard daemon with budget cap -- stop with `/daemon stop`, no work is lost
- **Red:** Daemon with `--budget unlimited` -- no automatic cost protection

Red actions (unlimited budget) require explicit confirmation at ALL trust levels.

### Proportionality
Before starting, verify daemon is warranted:
- If campaign has only 1 remaining phase: suggest running it directly instead
- If estimated sessions <= 2: suggest manual continuation instead
- If campaign is type `improve` and no rubric exists: block -- rubric requires human approval first

### Trust Gating
Read trust level from `harness.json`:
- **Novice** (0-4 sessions): Block daemon activation entirely. Output: "Daemon mode requires familiarity with the harness. Complete a few sessions first, then daemon will be available."
- **Familiar** (5-19 sessions): Allow with full disclosure and explicit confirmation.
- **Trusted** (20+ sessions): Allow with cost-only confirmation.

## Quality Gates

- Budget cap MUST be set (default $50, explicit `unlimited` to bypass)
- Daemon state file MUST be written before any triggers are created
- Both triggers (chain + watchdog) must be created; if either fails, abort and clean up
- Every tick must update daemon.json BEFORE scheduling the next tick
- Campaign must have Continuation State before daemon can start
- Lock mechanism must prevent overlapping sessions
- Watchdog must detect and recover from dead chains
- Stop must clean up ALL triggers (no orphaned triggers)

## Exit Protocol

- `start`: confirmation output, no HANDOFF
- `stop`: stop summary, no HANDOFF
- `tick`: no user output (headless); updates daemon.json, schedules or stops
- `status`/`log`: output requested info
- On error: actionable message, clean up any dangling triggers before exiting
