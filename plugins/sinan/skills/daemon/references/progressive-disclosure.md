# daemon Progressive Disclosure

Use this reference for bulky operational variants, examples, and edge-case details that should stay out of always-read skill orientation.

## Local Lane

`/daemon start` validates the campaign, checks existing state, and writes
`.planning/daemon.json` with trigger IDs set to `null`. It then tells the user to
run `npm run daemon:local` in a separate terminal. That loop spawns
`claude -p "/do continue"`, respects daemon state, and consumes no routine quota.

## Codex Automation Lane

When available, generate a Codex automation plan:

```bash
node scripts/codex-automation.js plan --type daemon --command "/daemon tick" --cadence "<interval>" --target background-worktree --write
```

Codex owns scheduling; daemon state owns budget, status gates, and the run log.

## Remote Routine Lane

Use only when the user passed `--remote` and confirmed the account-wide routine
quota risk. Remote routines create a chain trigger and watchdog trigger, both
pointing at `/daemon tick` commands for the project root.

## Tick Gates

Each tick reads `.planning/daemon.json`, then applies:

- status gate: exit unless running or waiting for approved level-up resume
- lock gate: prevent overlapping sessions
- budget gate: stop before spend exceeds the cap
- campaign gate: stop when the campaign is missing, completed, failed, or parked
- level-up gate: pause, keep watchdog alive, and wait for human approval

After `/do continue`, record session count, estimated spend, phase summary, and
latest status. Run `node scripts/memory-compile.js compile` when planning state
changed; failures are logged but must not create overlapping ticks.

## Hook Bridge And Budget

The SessionStart hook is the primary bootstrap: it reads daemon state, checks
lock/budget/campaign, and prints the `/do continue` instruction when safe. The
primary cost source is `.planning/telemetry/session-costs.jsonl`; fallback is
`costPerSession`.

## Watchdog And Fringe Cases

The watchdog restarts the chain if `lastTickAt` is older than `2 * interval` and
no tick is running. If remote routines are unavailable, use the SessionStart
bridge with OS cron or manual restart. One daemon runs per project. Corrupted
state is treated as no daemon. A campaign without Continuation State should be
opened once with `/archon` to establish resume data.
