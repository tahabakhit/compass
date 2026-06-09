## Quick Mode

`/fleet --quick [task1]; [task2]; [task3]`

### Differences from standard fleet

| Property | Standard Fleet | Quick Mode |
|---|---|---|
| Min streams | 3 | 2 |
| Min complexity | 4 | 3 |
| Waves | Multi-wave with discovery relay | Single wave only |
| Session file | Written to `.planning/fleet/` | Skipped — results reported inline |
| Discovery briefs | Compressed to `.planning/fleet/briefs/` | Skipped |
| Merge | Per-wave confirmation | Auto-merge if no conflicts |
| Scope claim | Written to coordination/ | Skipped |

### Protocol

1. Parse tasks from the `--quick` argument (semicolon-separated)
2. Validate scope overlap — if any two tasks touch the same files, merge them or sequence them
3. Spawn all agents simultaneously with `isolation: "worktree"`
4. Collect results; auto-merge worktrees if no conflicts detected
5. If merge conflict: surface to user, offer manual resolution
6. Report results inline — no session file written unless the user asks

### When /do routes here

`/do` routes to `--quick` mode (not standard fleet) when:
- Input contains "at the same time", "simultaneously", "in parallel", "both ... and"
- Two or more clearly independent tasks are detected
- Complexity is 3 (moderate), not 4+ (complex)
- User chose "1" (yes once) or "2" (always) on the Fleet confirmation prompt

Entry from `/do` confirmation prompt: user chose yes (1) or always (2). Preferences stored under `consent.fleetSpawn` in harness.json via `readConsent`/`writeConsent`.
