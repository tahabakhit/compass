---
name: architecture-deepening
description: "Use when a codebase needs deepening opportunities: shallow modules, weak interfaces, coupling, testability friction, or a prioritized architecture refactor report."
---

# Architecture Deepening

Use this skill when the user wants the deeper architecture-review pass, not just a local design review.

## Workflow

1. Map the relevant modules, interfaces, callers, and tests.
2. Look for shallow modules: interfaces that are nearly as complex as their implementations.
3. Apply the deletion test: if deleting a module removes complexity, it may be pass-through; if complexity spreads to callers, it is earning its keep.
4. Find opportunities to improve locality and leverage behind smaller interfaces.
5. Prefer concrete refactor candidates over broad rewrites.
6. For each candidate, name files, current friction, proposed move, expected test improvement, and migration sequence.
7. Mark each candidate `Strong`, `Worth exploring`, or `Speculative`.

Use `architecture-sweep` when the review spans multiple modules or needs sequencing.

## Output

Return a prioritized list by default. Write an HTML report in the OS temp directory only when the user asks for a visual report.
