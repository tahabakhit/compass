---
name: adversarial-review
description: >-
  Use when red-team review for high-risk changes. Looks for concrete failure
  paths, abuse cases, security gaps, and tests that should fail before fixes.
user-invocable: true
---
# /adversarial-review — Red-Team Failure Search

## Orientation

**Use when:** a change touches auth, permissions, payments, data deletion, user-generated content, external calls, parsing, migrations, or any broad workflow where ordinary review may miss abuse paths.
**Don't use when:** the user asked for a normal code review only. Use `/review` first, then this skill for high-risk surfaces.

This skill captures the Superpowers red-team idea as an explicit Sinan review path, not an always-on cost center.

## Protocol

### Step 1 — Resolve Scope

Review one of:

- A file or directory
- A diff range
- The current uncommitted diff
- A campaign phase output

Load the relevant code, tests, and project rules. Keep generated files, lock files, and binary assets out of scope unless the change depends on them.

### Step 2 — Build the Attack Surface

List concrete entry points:

- User input and request bodies
- Auth/session/permission decisions
- File, URL, shell, SQL, template, eval, or deserialization boundaries
- External APIs and webhooks
- Data deletion, migration, and idempotency paths
- UI flows that can mislead users into destructive actions

### Step 3 — Generate Failure Scenarios

For large or high-risk scopes, spawn the `red-team` agent and give it only the
changed files, requirements, and risk boundaries. It returns a Breakage Report
focused on concrete failure scenarios and production context assumptions.

For each entry point, try to break the system:

- Bypass authorization or tenant boundaries
- Inject commands, queries, markup, or templates
- Trigger SSRF, path traversal, open redirect, or unsafe deserialization
- Cause data loss through retries, races, or partial failure
- Exhaust resources with large inputs or nested structures
- Abuse stale state, replay, double submit, or out-of-order events

Prefer concrete payloads and call sequences over abstract warnings.

### Step 4 — Turn Findings Into Tests

For each critical/high finding, propose the first failing test that would prove it.

If asked to fix, use `/tdd`:

1. Write the failing exploit/regression test.
2. Apply the smallest fix.
3. Re-run targeted and broader verification.

## Output Format

```text
## Adversarial Review: <scope>

### Attack Surface
- <entry point>: <risk boundary>

### Findings
- Severity: critical|high|medium|low
  File: <path:line>
  Scenario: <concrete abuse/failure path>
  Evidence: <code path or missing guard>
  Test to add: <specific failing test>
  Fix direction: <specific mitigation>

### Verdict
PASS | CONDITIONAL | FAIL
```

## Quality Bar

- Every finding must name a real path through the system.
- Do not report generic OWASP categories without tying them to code.
- Do not recommend broad rewrites when a narrow guard or invariant test would address the risk.
- For high-risk scopes, either use the `red-team` agent or explain why direct review is sufficient.

## Fringe Cases

**No diff or scope is provided:** Default to `git diff HEAD`. If there are no changes, ask for a file, directory, or diff range.

**No tests exist:** Still report the failure scenario and propose the smallest manual reproduction. Do not claim an automated guard exists.

**Finding depends on deployment config:** Mark it conditional and name the config value or environment assumption that decides whether the risk is real.

**The issue is pre-existing:** Report it separately from change-introduced findings so the user can prioritize current-work regressions.

## Exit Protocol

```text
---HANDOFF---
- Scope: <files/diff reviewed>
- Verdict: PASS | CONDITIONAL | FAIL
- Critical/high findings: <count>
- Tests to add: <list or none>
- Fix route: /tdd for critical/high findings, /review for ordinary cleanup
---
```
