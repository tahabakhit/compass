---
name: bootstrap
description: Use when starting or resuming a repo and deciding which early Sinan steps are needed before implementation.
disable-model-invocation: true
---

# Bootstrap

Use this skill as the startup front door for a new, empty, partial, or resumed repo.

## Workflow

1. Inspect the repo or workspace state before recommending work: git status, nested repos, file tree, package manager, README, tests, CI, app files, agent files, glossary, ADRs, and GitHub surfaces.
2. Run `python3 -m scripts.sinan.cli bootstrap --target <repo-or-workspace> --json` when available; add `--persist` when the startup plan should be saved under `.workflow-state/plans/bootstrap-report.json`.
3. Look for prior context first: pasted handoff, `.planning/handoffs/`, `.workflow-state/runs/`, recent commits, and continuation notes.
4. Classify the target as empty, foundation-only, app-started, established, workspace, or resumed-from-handoff.
5. Recommend only the needed next steps: `$brainstorm`, `$decision-capture`, `$architecture`, `$scaffold`, `$starter`, or `$tdd`.
6. Ask before writing. Do not generate app files unless the repo is empty/near-empty or the user explicitly requests starter files.
7. Preserve existing decisions and handoff instructions unless evidence says they are stale.
8. In a multi-repo workspace, use the parent `.planning/` and `.workflow-state/` for cross-repo work, but keep repo-specific ADRs and canonical docs in each child repo.

## Output

End with repo/workspace state, handoff context found, nested repo summary, recommended startup path, skipped steps with reasons, any persisted plan paths, and the next concrete command or skill.
