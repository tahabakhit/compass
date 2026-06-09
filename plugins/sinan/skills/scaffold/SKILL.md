---
name: scaffold
description: Use when setting up or refreshing agent-facing repo guidance such as AGENTS.md, CLAUDE.md, GLOSSARY.md conventions, ADR conventions, and GitHub workflow/label guidance.
---

# Scaffold

Use this skill when a repo needs agent-facing instruction and memory surfaces before or during early implementation.

This is not an app generator. Use `bootstrap` for empty-repo technical setup and `$starter` for generating the initial framework/app files.

## Workflow

1. Inspect existing `AGENTS.md`, `CLAUDE.md`, `GLOSSARY.md`, `docs/adr/`, `.github/workflows/`, and issue label conventions.
2. If files exist, preserve manual text and only update marked Sinan blocks.
3. Make `AGENTS.md` the canonical shared project guidance.
4. Make `CLAUDE.md` import `AGENTS.md`, then add only Claude Code-specific notes.
5. Capture the startup flow: bootstrap, brainstorm, decision capture, architecture, scaffold, starter or first-slice implementation, review, deepen, handoff.
6. Propose the scaffold before writing unless the user explicitly asked to generate it.
7. Run `node scripts/scaffold-instructions.js --target <repo>` to write, or `--check` to verify.

## Defaults

- `AGENTS.md`: shared context, Sinan workflows, Codex-facing operating rules.
- `CLAUDE.md`: `@AGENTS.md` plus Claude Code-specific tool and planning notes.
- `GLOSSARY.md`: domain vocabulary only, created later when real terms stabilize.
- `docs/adr/`: architectural decisions only, created later when a decision is durable.
- `.github/workflows/`: inspect and document existing CI; create workflow templates only when explicitly requested.
- GitHub labels: prefer a small triage vocabulary such as `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `bug`, `enhancement`, `docs`, and `architecture`.
