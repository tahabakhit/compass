---
name: tdd
description: >-
  Use when strict red-green-refactor workflow for behavior changes. Use when
  the user asks for TDD, tests first, regression fixes, or any change where
  behavior should be locked before implementation.
user-invocable: true
---
# /tdd — Test-First Implementation

## Orientation

**Use when:** behavior changes, bug fixes need regression coverage, or the user asks for tests first.
**Don't use when:** the task is pure docs, formatting, generated metadata, or a mechanical refactor already covered by existing tests.

This skill imports the useful Superpowers Optimized discipline into Sinan without making it an always-on router.

## Protocol

### Step 1 — Detect the test surface

Find the smallest existing verification command that can exercise the target behavior.

Check, in order:

1. Package scripts: `npm test`, `npm run test`, `pnpm test`, `yarn test`
2. Language-native runners: `pytest`, `go test`, `cargo test`, `dotnet test`, `mvn test`
3. Project-specific scripts in `Makefile`, `justfile`, `scripts/`, or CI config

If no runner exists, ask before installing one. If the user declines, document the manual reproduction path and do not claim TDD.

### Step 2 — RED

Write exactly one failing test for one behavior.

Run the narrowest command. Confirm the failure is expected:

- The test reaches the intended code path.
- The failure proves missing or incorrect behavior.
- It is not failing because of syntax, imports, fixtures, environment, or the runner itself.

If the failure reason is wrong, fix the test or setup before production code changes.

### Step 3 — GREEN

Make the smallest production change that turns the observed failure green.

Do not bundle nearby cleanup, speculative cases, or unrelated fixes into the green step.

### Step 4 — REFACTOR

Clean up only after the target test passes. Re-run the target test after each meaningful refactor.

### Step 5 — Broaden Verification

Run the relevant broader command:

- Changed package/module tests
- Typecheck or lint when present
- Integration or browser checks for user-visible behavior

## Completion Evidence

Report:

```text
TDD evidence:
- Red: <command> failed with <expected reason>
- Green: <command> passed after <change>
- Broader verification: <command/result>
```

## Quality Gates

- A test runner or explicit manual verification path is identified before implementation.
- At least one changed behavior has an observed red test before production changes.
- The red failure reason matches the intended missing or broken behavior.
- The green step changes only the minimum production code needed.
- Targeted tests and relevant broader verification pass before completion is claimed.

## Fringe Cases

**No test framework exists:** Ask before installing one. If the user declines, document the manual reproduction path and do not call the work TDD.

**Existing test already fails:** Confirm whether it is the same behavior. If yes, use it as the red test. If no, isolate or document the pre-existing failure before adding another test.

**Generated or hard-to-test code:** Add the test at the nearest stable boundary. If there is no stable boundary, document the seam needed before changing production code.

**Pure refactor:** Run existing tests first, make one structural change, then rerun the same tests. Do not add behavior tests unless behavior is changing.

## Stop Rules

- If the test passes before production code changes, it did not prove the behavior. Rewrite it.
- If two green attempts fail, stop and switch to `/systematic-debugging`.
- If the behavior cannot be tested with the current architecture, explain the seam needed before changing production code.

## Exit Protocol

```text
---HANDOFF---
- Behavior: <what was changed>
- Red: <command and expected failure>
- Green: <minimal fix summary and passing target command>
- Broader verification: <commands/results>
- Follow-up: <remaining test seam or none>
---
```
