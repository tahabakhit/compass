---
name: diagnose
description: Use when failing tests, regressions, broken behavior, crashes, or performance problems need evidence-based diagnosis before fixing.
---

# Diagnose

Use this skill for bugs and regressions where guessing would make the fix brittle.

## Workflow

1. Reproduce the behavior or failing test.
2. Minimize the case until the signal is clear.
3. Form a hypothesis from observed evidence.
4. Add focused instrumentation only when it reduces uncertainty.
5. Patch the smallest responsible behavior.
6. Add or update a regression test.
7. Run the narrow check first, then the broader relevant suite.

Prefer the `debug` workflow for multi-step or risky failures.
