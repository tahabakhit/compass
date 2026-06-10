---
name: scaffold
description: Use when setting up or refreshing agent-facing repo guidance such as AGENTS.md, CLAUDE.md, GLOSSARY.md conventions, ADR conventions, and GitHub workflow/label guidance.
---

# Scaffold

Use this skill when a repo needs agent-facing instruction, memory conventions, GitHub labels, and lightweight agent-check workflow surfaces before or during early implementation.

This is not an app generator. Use `$bootstrap` for startup sequencing and `$starter` for generating the initial framework/app files.

## Workflow

1. Inspect existing `AGENTS.md`, `CLAUDE.md`, `GLOSSARY.md`, `docs/adr/`, `.github/labels.yml`, `.github/workflows/`, and issue label conventions.
2. If files exist, preserve manual text and only update marked Sinan blocks.
3. Make `AGENTS.md` the canonical shared project guidance.
4. Make `CLAUDE.md` import `AGENTS.md`, then add only Claude Code-specific notes.
5. Create empty memory convention surfaces for `GLOSSARY.md` and `docs/adr/README.md`; put actual terms and ADRs through `$decision-capture`.
6. Propose the scaffold before writing unless the user explicitly asked to generate it.
7. Run `node scripts/scaffold-instructions.js --target <repo>` to write, or `--check` to verify.
8. If `.github/labels.yml` or `.github/workflows/agent-checks.yml` already exist without Sinan markers, preserve them and report that manual files were skipped.

## Defaults

- `AGENTS.md`: shared context, Sinan workflows, Codex-facing operating rules.
- `CLAUDE.md`: `@AGENTS.md` plus Claude Code-specific tool and planning notes.
- `GLOSSARY.md`: domain vocabulary conventions only until `$decision-capture` adds confirmed terms.
- `docs/adr/README.md`: ADR conventions only until `$decision-capture` writes durable decisions.
- `.github/labels.yml`: small triage label manifest for humans or label-sync tooling.
- `.github/workflows/agent-checks.yml`: lightweight workflow that checks expected agent guidance files exist.
- GitHub labels: prefer a small triage vocabulary such as `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `bug`, `enhancement`, `docs`, and `architecture`.
