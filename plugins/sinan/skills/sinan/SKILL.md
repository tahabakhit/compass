---
name: sinan
description: Use when Sinan should route a task, deciding whether to stay light, clarify, run workflows, or use native Codex and Claude capabilities.
---

# Sinan

Use this skill when the user wants Sinan to choose the work shape, route a request, or coordinate a larger task.

## Workflow

1. Keep micro tasks direct: answer or run the requested command without loading workflows, agents, or extra skills.
2. If the task is ambiguous, route to the `clarify` workflow or use `$grill` for a focused interview.
3. For implementation, debugging, review, research, cleanup, architecture, or setup work, prefer the matching workflow in `workflows/`.
4. Use `scripts/route.js` when a deterministic preview is useful.
5. Prefer native platform capabilities over Sinan machinery when they fit: Codex plan mode, Codex subagents, Claude plan mode, or Claude dynamic workflows.
6. Keep route explanations short and include only the selected workflow, skills, native mode, agents, hooks, and budget.

## Guardrails

- Do not copy old Sinan skill bodies into the active context.
- Do not mutate old Sinan evidence directories.
- Do not allocate agents for micro tasks.
- Keep generated or persisted state under the paths declared by the workflow runner.
