---
name: project-scaffold
description: Use when starting a greenfield repo or setting up project agent instructions such as AGENTS.md, CLAUDE.md, CONTEXT.md, and ADR conventions.
---

# Project Scaffold

Use this skill when a repo needs agent-facing instruction surfaces before or during early implementation.

## Workflow

1. Inspect existing `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, and `docs/adr/`.
2. If files exist, preserve manual text and only update marked Sinan blocks.
3. Make `AGENTS.md` the canonical shared project guidance.
4. Make `CLAUDE.md` import `AGENTS.md`, then add only Claude Code-specific notes.
5. Capture the greenfield flow: grill, decision capture, first-slice plan, implement, review, deepen, handoff.
6. Propose the scaffold before writing unless the user explicitly asked to generate it.
7. Run `node scripts/scaffold-instructions.js --target <repo>` to write, or `--check` to verify.

## Defaults

- `AGENTS.md`: shared context, Sinan workflows, Codex-facing operating rules.
- `CLAUDE.md`: `@AGENTS.md` plus Claude Code-specific tool and planning notes.
- `CONTEXT.md`: domain glossary only, created later when real terms stabilize.
- `docs/adr/`: architectural decisions only, created later when a decision is durable.
