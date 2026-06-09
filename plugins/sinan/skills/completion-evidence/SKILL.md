---
name: completion-evidence
description: >-
  Use when verification-before-completion gate. Use before saying done, fixed,
  tests pass, ready to merge, or any similar completion claim.
user-invocable: true
---
# /completion-evidence — Verify Before Claiming Done

## Orientation

**Use when:** preparing to say done, fixed, tests pass, build succeeds, or ready to merge.
**Don't use when:** checking Sinan hook health. Use `/verify` for hook pipeline self-tests.

This imports Superpowers Optimized's completion gate into Sinan as an explicit route.

## Protocol

### Step 1 — Identify The Claim

Write the exact claim you are about to make:

- Tests pass
- Bug is fixed
- Build succeeds
- Ready to merge
- Requirement is implemented

### Step 2 — Identify Proof

Choose the command or observation that would prove the claim.

Minimum evidence:

- Tests: fresh command output with zero failures
- Build: successful exit code
- Bugfix: reproduction now passes
- Requirement: explicit checklist against accepted scope

### Step 3 — Run Fresh Evidence

Run the command now. Inspect exit code and output. Old output, subagent claims,
and "should pass" reasoning are not evidence.

### Step 4 — Check What It Does Not Prove

If the change affects a condition, gate, route, provider, feature flag,
environment variable, permission, or credential, state what the evidence does
not cover. If that reveals a gap, gather more evidence before claiming done.

### Step 5 — Stub Scan

For production-code changes, scan modified source files for unfinished work:

```bash
grep -rn "TODO\\|FIXME\\|placeholder\\|NotImplementedError\\|raise NotImplementedError" <changed-src-files>
```

Ignore test fixtures and intentional comments only when they are clearly unrelated.

### Step 6 — Self-Consistency Gate

When evidence interpretation is non-trivial, invoke `/self-consistency-reasoner`
internally:

- One path checks what the evidence proves.
- One path checks what it does not prove.
- One path checks alternative explanations for the output.

Do not claim completion if there is no majority verdict.

## Quality Gates

- Evidence must be fresh from the current worktree.
- Exit codes and relevant output must be inspected, not assumed.
- Completion wording must match what the evidence actually proves.
- Regression tests for bugfixes must have been observed failing or otherwise be identified as unproven.
- Stub scan must not find unfinished implementation in files changed by the task.

## Fringe Cases

**No runnable verification exists:** State that completion is unverified and name the missing command or environment.

**Command fails for unrelated pre-existing reasons:** Report the failure as a blocker or limitation. Do not claim the whole task is verified.

**Subagent reports success:** Check the diff and run verification independently.

**Configuration-only change:** Verify the resulting behavior or observable config, not merely that a command completed.

## Exit Protocol

```text
---HANDOFF---
- Claim: <exact claim>
- Evidence: <command/output summary>
- Result: verified | unverified | failed
- Gaps: <what evidence does not prove>
- Stub scan: pass | fail | not applicable
---
```
