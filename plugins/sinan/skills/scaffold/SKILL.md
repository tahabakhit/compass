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
4. Keep `CLAUDE.md` as a short Claude entrypoint that imports `AGENTS.md` first, then adds only Claude-specific tool, command, and permission notes. Never hand-write `AGENTS.md`/`CLAUDE.md`/`.agents/*`; the write-guard hook blocks that. Route them through the scaffold CLI.
5. Create durable memory convention surfaces for `GLOSSARY.md`, `docs/adr/README.md`, and `docs/reference/README.md`; put actual terms and ADRs through `$decision-capture`.
6. Create `.planning/` and `.workflow-state/` scaffold only for workspace targets; standalone repos get them from `$bootstrap` persistence, and child repos under a workspace keep planning in the parent.
7. `.github` is minimal by default: scaffold writes only `.github/workflows/agent-checks.yml`. Generate the guided bundle (labels, PR/issue templates, copilot-instructions) only after interrogating repo purpose, then run `<sinanCli> scaffold --target <repo> --with-github`. Never overwrite unmarked `.github` files.
8. If `AGENTS.md`/`CLAUDE.md` already exist unmarked or pointing the wrong way (AGENTS.md importing CLAUDE.md), audit/scaffold reports an entrypoint repair proposal with a diff. Show it to the user; apply with `<sinanCli> scaffold --target <repo> --replace-entrypoints` (or `--force` unattended).
9. Propose the scaffold before writing unless the user explicitly asked to generate it.
10. Run `<sinanCli> audit --target <repo>` for advisory audit, `<sinanCli> scaffold --target <repo>` to write, or `<sinanCli> enforce --target <repo>` for opt-in failing verification.
11. If `.github/labels.yml`, `.github/workflows/agent-checks.yml`, or GitHub templates already exist without Sinan markers, preserve them and report that manual files were skipped.

## Defaults

- `.agents/`: canonical shared bundle (layout, workflow, routing, review, safety, surfaces).
- `AGENTS.md`: short shared entrypoint to `.agents/`. `CLAUDE.md`: imports `AGENTS.md`, adds Claude-only tool/command/permission notes.
- `GLOSSARY.md`, `docs/adr/README.md`, `docs/reference/README.md`: memory conventions only until `$decision-capture` adds real content.
- `.planning/` (human working memory) and `.workflow-state/` (machine state): workspace roots and standalone repos; not child repos.
- `.github` minimal default: only `.github/workflows/agent-checks.yml`. Guided bundle (`--with-github`): copilot-instructions, labels, PR/issue templates.
- GitHub labels (guided): a small triage vocabulary such as `needs-triage`, `ready-for-agent`, `ready-for-human`, `bug`, `enhancement`, `docs`, `architecture`.
