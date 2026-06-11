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

## Controlling behavior

This skill is controlling, not advisory. Always resolve the work shape by running the
deterministic router first, then execute what it returns:

1. Run `<sinanCli> route --platform <claude|codex> --prompt "<the user request>" --json` (the
   router reads the target directory state from `cwd`, so run it from the target repo or pass
   the correct working directory).
2. Read the `nextCommand` field. If it is non-null, run it **before** writing any files or asking
   stack questions. `nextCommand` is the required first command for setup work:
   - bootstrap → `<sinanCli> bootstrap --target <repo> --json`
   - scaffold → `<sinanCli> scaffold --target <repo>` (audit first with `<sinanCli> audit` if you
     only need a diff)
   - starter → `<sinanCli> starter --plan --target <repo> --json`, then generate app files only
     after the plan is confirmed.
3. Do not hand-write `AGENTS.md`, `CLAUDE.md`, or `.agents/*`. The write-guard hook blocks those
   writes; route the work through `scaffold` instead.

## Workflow

1. Keep micro tasks direct: answer or run the requested command without loading workflows, agents, or extra skills.
2. For setup work, follow the router's `nextCommand` (bootstrap for empty/foundation-only repos, scaffold for agent policy, starter for app files). Never skip the gate.
3. If the task is ambiguous, route to the `clarify` workflow or use `$brainstorm` for structured exploration.
4. For implementation, debugging, review, research, cleanup, architecture, deepening, or setup work, prefer the matching workflow in `workflows/`.
5. Use `<sinanCli> test` when deterministic route/workflow checks need validation.
6. Prefer native platform capabilities over Sinan machinery when they fit: Codex plan mode, Codex subagents, Claude plan mode, Claude dynamic workflows, or Claude Code's `/codex:*` commands when `codex@openai-codex` is installed.
7. Keep route explanations short and include only the selected workflow, skills, native mode, agents, hooks, budget, and `nextCommand`.

## Guardrails

- Do not copy retired skill bodies into the active context.
- Do not allocate agents for micro tasks.
- Do not hand-roll agent-surface files; the write-guard will deny it. Use `scaffold`.
- Keep generated or persisted state under the paths declared by the workflow runner.
