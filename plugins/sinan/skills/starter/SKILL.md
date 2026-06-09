---
name: starter
description: Use after brainstorm, decision capture, and architecture when generating initial framework or application files for the first vertical slice.
---

# Starter

Use this skill when the repo needs initial app/framework files, not just a plan.

## Workflow

1. Confirm product direction, architecture, package manager, runtime, test command, styling choice, and first vertical slice.
2. Run `node scripts/starter-plan.js --target <repo> --json` when available.
3. Inspect existing files before generating anything.
4. Propose the starter shape before writing unless the user explicitly asked to generate it.
5. Generate the smallest useful shell: config, source layout, first route or entry point, starter tests, and scripts.
6. Avoid broad templates, sample clutter, and unchosen framework defaults.
7. Verify install, lint, test, and run commands when available.
8. Hand off to `$tdd` for the first real feature.

## Output

End with generated files, commands verified, remaining setup gaps, and the next implementation step.
