---
name: tdd
description: Use when implementation should proceed through a focused red-green-refactor loop with scoped regression coverage.
---

# TDD

Use this skill when implementation should be driven by executable behavior.

## Workflow

1. Inspect existing tests and local patterns.
2. Write the smallest failing test that captures the desired behavior.
3. Run it and confirm the failure is meaningful.
4. Implement the smallest change that passes.
5. Refactor only after the behavior is green.
6. Run the relevant broader suite before finishing.

For broad feature work, use the `implement` workflow and this skill as the implementation loop.
