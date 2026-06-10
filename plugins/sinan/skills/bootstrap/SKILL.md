---
name: bootstrap
description: Use when starting or resuming a repo and deciding which early Sinan steps are needed before implementation.
---

# Bootstrap

Use this skill as the startup front door for a new, empty, partial, or resumed repo.

## Workflow

1. Inspect the repo state before recommending work: git status, file tree, package manager, README, tests, CI, app files, agent files, glossary, ADRs, and GitHub surfaces.
2. Run `node scripts/bootstrap-report.js --target <repo> --json` when available; add `--persist` when the startup plan should be saved under `.sinan/plans/bootstrap-report.json`.
3. Look for prior context first: pasted handoff, `HANDOFF.md`, `handoff.md`, `.sinan/runs/`, `.planning/sinan`, recent commits, and continuation notes.
4. Classify the repo as empty, foundation-only, app-started, established, or resumed-from-handoff.
5. Recommend only the needed next steps: `$brainstorm`, `$decision-capture`, `$architecture`, `$scaffold`, `$starter`, or `$tdd`.
6. Ask before writing. Do not generate app files unless the repo is empty/near-empty or the user explicitly requests starter files.
7. Preserve existing decisions and handoff instructions unless evidence says they are stale.

## Output

End with repo state, handoff context found, recommended startup path, skipped steps with reasons, any persisted plan path, and the next concrete command or skill.
