---
name: task-router
description: Use when a request should be classified into direct work, focused clarification, a Sinan workflow, or native Codex/Claude execution mode.
---

# Task Router

Use this skill when the user wants Sinan to choose the right work shape for a request.

## Packaged CLI

Use the `sinanCli` command from Sinan startup context for deterministic CLI checks. It points at this installed plugin's `scripts/sinan/run.py` wrapper and works from any current directory.

If startup context is unavailable, derive the plugin root from this skill's installed path and run `python3 "<plugin-root>/scripts/sinan/run.py" <command> ...`.

Do not run `python3 -m scripts.sinan.cli` from the target repo or workspace; that import only works when Python is already anchored to the Sinan plugin root.

## Workflow

1. Keep micro tasks direct: answer or run the requested command without loading workflows, agents, or extra skills.
2. If the task is ambiguous, route to the `clarify` workflow or use `$brainstorm` for structured exploration.
3. For implementation, debugging, review, research, cleanup, architecture, deepening, or setup work, prefer the matching workflow in `workflows/`.
4. Use `<sinanCli> test` when deterministic route/workflow checks need validation.
5. Prefer native platform capabilities over Sinan machinery when they fit: Codex plan mode, Codex subagents, Claude plan mode, Claude dynamic workflows, or Claude Code's `/codex:*` commands when `codex@openai-codex` is installed.
6. Keep route explanations short and include only the selected workflow, skills, native mode, agents, hooks, and budget.

## Guardrails

- Do not copy retired skill bodies into the active context.
- Do not allocate agents for micro tasks.
- Keep generated or persisted state under the paths declared by the workflow runner.
