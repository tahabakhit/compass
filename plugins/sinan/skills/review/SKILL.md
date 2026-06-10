---
name: review
description: Use when reviewing code, PRs, or diffs for high-confidence bugs, behavioral regressions, missing tests, and risky changes.
disable-model-invocation: true
---

# Review

Use this skill for code review, PR review, and diff risk assessment.

## Native Review

Prefer native review first: Codex `/review`; Claude Code `/codex:review` or
`/codex:adversarial-review` when `codex@openai-codex` is installed. Otherwise
use this skill plus `review` workflow.

Use adversarial review for red-team, second-opinion, challenge, or risk reviews:

```text
/codex:adversarial-review --background hidden assumptions, failure modes, simpler alternatives
/codex:adversarial-review --base main --background data-loss, auth, rollback, race risks
```

Prefer `--background`. Treat Codex output as read-only.

## Workflow

1. Inspect the diff and surrounding code paths.
2. Trace behavior from inputs to outputs before naming a bug.
3. Prioritize correctness, regressions, security, data loss, and missing tests.
4. Report only findings that are actionable and evidence-backed.
5. Order findings by severity and include precise file references.

Avoid style-only feedback unless the user asks for it.
