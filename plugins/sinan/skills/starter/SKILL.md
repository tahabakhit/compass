---
name: starter
description: Use when generating initial framework or application files for the first vertical slice after brainstorm, decision capture, and architecture.
disable-model-invocation: true
---

# Starter

Use this skill when the repo needs initial app/framework files, not just a plan.

## Packaged CLI

Use the `sinanCli` command from Sinan startup context for deterministic CLI work. It points at this installed plugin's `scripts/sinan/run.py` wrapper and works from any current directory.

If startup context is unavailable, derive the plugin root from this skill's installed path and run `python3 "<plugin-root>/scripts/sinan/run.py" <command> ...`.

Do not run `python3 -m scripts.sinan.cli` from the target repo or workspace; that import only works when Python is already anchored to the Sinan plugin root.

## Workflow

1. Confirm product direction, architecture, package manager, runtime, test command, styling choice, and first vertical slice.
2. Do not run legacy JS helpers. Inspect the target with `<sinanCli> bootstrap --target <repo> --json`, then propose starter files before writing.
3. Inspect existing files before generating anything.
4. Propose the starter shape before writing unless the user explicitly asked to generate it.
5. Generate the smallest useful shell: config, source layout, first route or entry point, starter tests, and scripts.
6. Avoid broad templates, sample clutter, and unchosen framework defaults.
7. Verify install, lint, test, and run commands when available.
8. Hand off to `$tdd` for the first real feature.

## Output

End with generated files, commands verified, any persisted plan path, remaining setup gaps, and the next implementation step.
