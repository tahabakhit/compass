---
name: scaffold
description: Use when setting up or refreshing repo-local agent policy such as .agents/, AGENTS.md, CLAUDE.md, GitHub Copilot instructions, GLOSSARY.md conventions, ADR conventions, and GitHub workflow/label guidance.
disable-model-invocation: true
---

# Scaffold

Use this skill when a repo needs agent-facing policy, memory conventions, GitHub labels, templates, and lightweight agent-check workflow surfaces before or during early implementation.

This is not an app generator. Use `$bootstrap` for startup sequencing and `$starter` for generating the initial framework/app files.

## Packaged CLI

Use the `sinanCli` command from Sinan startup context for deterministic CLI work. It points at this installed plugin's `scripts/sinan/run.py` wrapper and works from any current directory.

If startup context is unavailable, derive the plugin root from this skill's installed path and run `python3 "<plugin-root>/scripts/sinan/run.py" <command> ...`.

Do not run `python3 -m scripts.sinan.cli` from the target repo or workspace; that import only works when Python is already anchored to the Sinan plugin root.

## Workflow

1. Inspect existing `.agents/`, `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `GLOSSARY.md`, `docs/adr/`, `docs/reference/`, `.planning/`, `.workflow-state/`, `.wiki/`, `.github/labels.yml`, `.github/workflows/`, and issue label/template conventions.
2. Make `.agents/` the canonical shared repo-local policy bundle. Managed `.agents/*` scaffold files are Sinan-owned and may be overwritten by explicit scaffold/update commands.
3. Keep `AGENTS.md` as the shared agent entrypoint pointing to `.agents/`.
4. Keep `CLAUDE.md` as a short Claude entrypoint that imports `AGENTS.md` first, then adds only Claude-specific tool, command, and permission notes.
5. Create durable memory convention surfaces for `GLOSSARY.md`, `docs/adr/README.md`, and `docs/reference/README.md`; put actual terms and ADRs through `$decision-capture`.
6. Create `.planning/` and `.workflow-state/` scaffold only for workspace targets; child repo transient planning and handoffs should live in the parent workspace.
7. Propose the scaffold before writing unless the user explicitly asked to generate it.
8. Run `<sinanCli> audit --target <repo>` for advisory audit, `<sinanCli> scaffold --target <repo>` to write, or `<sinanCli> enforce --target <repo>` for opt-in failing verification.
9. If `.github/labels.yml`, `.github/workflows/agent-checks.yml`, or GitHub templates already exist without Sinan markers, preserve them and report that manual files were skipped.

## Defaults

- `.agents/`: shared layout, workflow, routing, review, safety, and surface-specific rules.
- `AGENTS.md`: short Codex entrypoint to `.agents/`.
- `CLAUDE.md`: imports `AGENTS.md` and adds Claude-specific tool, command, and permission notes.
- `.github/copilot-instructions.md`: short GitHub Copilot entrypoint to `.agents/`.
- `GLOSSARY.md`: domain vocabulary conventions only until `$decision-capture` adds confirmed terms.
- `docs/adr/README.md`: ADR conventions only until `$decision-capture` writes durable decisions.
- `docs/reference/README.md`: durable runbook/evidence conventions.
- `.planning/`: workspace-level human-readable working memory, templates, campaigns, plans, reviews, and handoffs.
- `.workflow-state/`: generated machine-readable workflow state.
- `.wiki/` and `~/.wiki/`: repo-local and personal/global durable knowledge, with writes routed through Zhi when available.
- `.github/labels.yml`: small triage label manifest for humans or label-sync tooling.
- `.github/workflows/agent-checks.yml`: lightweight workflow that checks expected agent guidance files exist.
- `.github/ISSUE_TEMPLATE/` and `.github/pull_request_template.md`: repo-owned templates after scaffold.
- GitHub labels: prefer a small triage vocabulary such as `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `bug`, `enhancement`, `docs`, and `architecture`.
