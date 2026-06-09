---
name: architecture
description: Use when a design needs architecture review for simpler boundaries, lower coupling, migration sequencing, or better testability.
---

# Architecture

Use this skill for structural design, simplification, and migration planning.

## Workflow

1. Start by mapping current responsibilities and boundaries.
2. Identify the pressure: duplication, coupling, unclear ownership, weak tests, or platform mismatch.
3. Prefer small sequencing plans over sweeping rewrites.
4. Keep domain language and existing decisions intact unless evidence says they are wrong.
5. Name tradeoffs and validation checks for each proposed move.

Use the `architecture-sweep` workflow when the work spans multiple modules or decisions.
