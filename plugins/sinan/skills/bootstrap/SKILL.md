---
name: bootstrap
description: Use when starting or resuming a repo and deciding which early Sinan steps are needed before implementation.
disable-model-invocation: true
---

# Bootstrap

Use this skill as the startup front door for a new, empty, partial, or resumed repo.

## Packaged CLI

Use the `sinanCli` command from Sinan startup context for deterministic CLI work. It points at this installed plugin's `scripts/sinan/run.py` wrapper and works from any current directory.

If startup context is unavailable, derive the plugin root from this skill's installed path and run `python3 "<plugin-root>/scripts/sinan/run.py" <command> ...`.

Do not run `python3 -m scripts.sinan.cli` from the target repo or workspace; that import only works when Python is already anchored to the Sinan plugin root.

## Workflow

1. Inspect the repo or workspace state before recommending work: git status, nested repos, file tree, package manager, README, tests, CI, app files, agent files, glossary, ADRs, and GitHub surfaces.
2. Run `<sinanCli> bootstrap --target <repo-or-workspace> --json` when available; add `--persist` to save the startup plan. Standalone repos and workspace roots persist locally (`.workflow-state/plans/bootstrap-report.json` plus a `.planning/` dir); repos nested under a workspace parent are not written to — their bootstrap state belongs in the parent workspace.
3. Look for prior context first: pasted handoff, `.planning/handoffs/`, `.workflow-state/runs/`, recent commits, and continuation notes.
4. Classify the target as empty, foundation-only, app-started, established, workspace, or resumed-from-handoff.
5. Recommend only the needed next steps: `$brainstorm`, `$decision-capture`, `$architecture`, `$scaffold`, `$starter`, or `$tdd`. Bootstrap inspects and recommends; it does not write agent surfaces — that is `$scaffold` (which the write-guard enforces).
6. Ask before writing. Do not generate app files unless the repo is empty/near-empty or the user explicitly requests starter files.
7. Preserve existing decisions and handoff instructions unless evidence says they are stale.
8. In a multi-repo workspace, use the parent `.planning/` and `.workflow-state/` for cross-repo work, but keep repo-specific ADRs and canonical docs in each child repo.

## Output

End with repo/workspace state, handoff context found, nested repo summary, recommended startup path, skipped steps with reasons, any persisted plan paths, and the next concrete command or skill.
